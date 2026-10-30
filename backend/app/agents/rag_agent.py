"""
rag_agent.py — RAG Agent (Retrieval-Augmented Generation) (MAF / AutoGen)

Manages the vector knowledge base for the platform.

Responsibilities:
  - Chunk uploaded documents into segments
  - Generate embeddings using OpenAI
  - Store embeddings in ChromaDB
  - Retrieve relevant context for user questions
  - Answer project-related questions using RAG

ChromaDB Collections:
  - requirements       : Requirement & architecture documents
  - meeting_transcripts: Processed meeting transcript text
  - architecture_docs  : Architecture and design documents

The RAG Agent does NOT write to MongoDB. It is the knowledge retrieval layer.
"""

import logging
import textwrap
from typing import Optional

import chromadb
from chromadb.utils import embedding_functions

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

# ChromaDB collection names
COLLECTION_REQUIREMENTS = "requirements"
COLLECTION_MEETINGS = "meeting_transcripts"
COLLECTION_ARCHITECTURE = "architecture_docs"

_chroma_client: Optional[chromadb.PersistentClient] = None


def get_chroma_client() -> chromadb.PersistentClient:
    """
    Return the shared ChromaDB persistent client.
    Initializes on first call.
    """
    global _chroma_client
    if _chroma_client is None:
        settings = get_settings()
        _chroma_client = chromadb.PersistentClient(path=settings.CHROMADB_PATH)
        logger.info(f"ChromaDB initialized at: {settings.CHROMADB_PATH}")
    return _chroma_client


def _get_embedding_function():
    """Return embedding function for ChromaDB (OpenAI if key present, else local default)."""
    settings = get_settings()
    key = settings.OPENAI_API_KEY
    if key and key.startswith("sk-") and "your-openai" not in key:
        return embedding_functions.OpenAIEmbeddingFunction(
            api_key=key,
            model_name="text-embedding-3-small",
        )
    # Local embedding fallback using ChromaDB default ONNX model (no key required)
    return embedding_functions.DefaultEmbeddingFunction()


def _get_or_create_collection(collection_name: str):
    """
    Get or create a ChromaDB collection with OpenAI embeddings.

    Args:
        collection_name: One of the three defined collection constants.

    Returns:
        chromadb.Collection instance.
    """
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=collection_name,
        embedding_function=_get_embedding_function(),
    )


def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """
    Split text into overlapping chunks for embedding.

    Args:
        text:       The full document text.
        chunk_size: Target size of each chunk in characters.
        overlap:    Number of characters to overlap between chunks.

    Returns:
        List of text chunks.
    """
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk.strip())
        start += chunk_size - overlap

    return [c for c in chunks if len(c) > 50]  # Filter very short chunks


async def ingest_document(
    document_text: str,
    document_id: str,
    project_id: str,
    doc_type: str,
    metadata: Optional[dict] = None,
) -> int:
    """
    Chunk a document, generate embeddings, and store in ChromaDB.

    Args:
        document_text: Full text content of the document.
        document_id:   MongoDB document _id for reference.
        project_id:    Associated project _id.
        doc_type:      "requirements", "architecture", or "meeting"
        metadata:      Optional additional metadata dict.

    Returns:
        Number of chunks ingested.
    """
    import asyncio

    # Map doc_type to collection
    collection_map = {
        "requirements": COLLECTION_REQUIREMENTS,
        "architecture": COLLECTION_ARCHITECTURE,
        "meeting": COLLECTION_MEETINGS,
    }
    collection_name = collection_map.get(doc_type, COLLECTION_REQUIREMENTS)

    chunks = _chunk_text(document_text)
    logger.info(
        f"RAGAgent: Ingesting {len(chunks)} chunks for document {document_id} "
        f"into collection '{collection_name}'"
    )

    # Run ChromaDB operations in thread pool (chromadb is sync)
    await asyncio.to_thread(
        _ingest_chunks_sync,
        chunks,
        document_id,
        project_id,
        collection_name,
        metadata or {},
    )

    return len(chunks)


def _ingest_chunks_sync(
    chunks: list[str],
    document_id: str,
    project_id: str,
    collection_name: str,
    metadata: dict,
) -> None:
    """Synchronous ChromaDB ingestion (runs in thread pool)."""
    collection = _get_or_create_collection(collection_name)

    ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "document_id": document_id,
            "project_id": project_id,
            "chunk_index": i,
            **metadata,
        }
        for i in range(len(chunks))
    ]

    # Upsert ensures re-ingestion doesn't create duplicates
    collection.upsert(
        documents=chunks,
        ids=ids,
        metadatas=metadatas,
    )


async def query_knowledge(
    query: str,
    project_id: str,
    n_results: int = 5,
) -> str:
    """
    Retrieve relevant context from ChromaDB and generate an answer using RAG.

    Args:
        query:      User's natural language question.
        project_id: Filter results to this project.
        n_results:  Number of context chunks to retrieve.

    Returns:
        AI-generated answer string.
    """
    import asyncio
    from openai import AsyncOpenAI, AsyncAzureOpenAI

    settings = get_settings()

    # Retrieve from all collections for breadth
    context_chunks = await asyncio.to_thread(
        _retrieve_context_sync, query, project_id, n_results
    )

    if not context_chunks:
        return "I couldn't find relevant information in the project knowledge base to answer your question."

    context = "\n\n---\n\n".join(context_chunks)

    # Generate answer
    if settings.LLM_PROVIDER == "azure":
        client = AsyncAzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        )
        model = settings.AZURE_OPENAI_DEPLOYMENT
    else:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        model = settings.OPENAI_MODEL

    system_prompt = """You are an intelligent project assistant with access to a project's requirements, 
meeting notes, and architecture documents. Answer questions clearly and concisely based on the provided context. 
If the answer is not in the context, say so honestly. Always cite which document/meeting the information comes from when possible."""

    user_prompt = f"""Context from project knowledge base:
{context}

Question: {query}

Answer:"""

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=1000,
    )

    return response.choices[0].message.content


def _retrieve_context_sync(
    query: str,
    project_id: str,
    n_results: int,
) -> list[str]:
    """
    Query all ChromaDB collections and return the most relevant chunks.
    Runs synchronously in a thread pool.
    """
    all_chunks = []
    collections = [
        COLLECTION_REQUIREMENTS,
        COLLECTION_MEETINGS,
        COLLECTION_ARCHITECTURE,
    ]

    for col_name in collections:
        try:
            collection = _get_or_create_collection(col_name)
            results = collection.query(
                query_texts=[query],
                n_results=min(n_results, 3),
                where={"project_id": {"$eq": project_id}},
            )
            if results["documents"]:
                all_chunks.extend(results["documents"][0])
        except Exception as e:
            logger.debug(f"RAGAgent: No results from '{col_name}': {e}")

    # Deduplicate while preserving order
    seen = set()
    unique_chunks = []
    for chunk in all_chunks:
        if chunk not in seen:
            seen.add(chunk)
            unique_chunks.append(chunk)

    return unique_chunks[:n_results]
