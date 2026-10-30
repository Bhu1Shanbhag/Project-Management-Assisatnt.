"""
document_parser.py — Document Parsing Service

Handles text extraction from:
  - .txt  — plain text files
  - .docx — Microsoft Word documents (python-docx)
  - .pdf  — PDF files (PyMuPDF / fitz)

Returns clean plaintext content for further processing by the agents.
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def parse_document(file_bytes: bytes, filename: str) -> str:
    """
    Extract plaintext from an uploaded file.

    Args:
        file_bytes: Raw bytes of the uploaded file.
        filename:   Original filename with extension.

    Returns:
        Extracted plaintext content as a string.

    Raises:
        ValueError: If the file format is not supported.
    """
    ext = Path(filename).suffix.lower()

    if ext == ".txt":
        return _parse_txt(file_bytes)
    elif ext == ".docx":
        return _parse_docx(file_bytes)
    elif ext == ".pdf":
        return _parse_pdf(file_bytes)
    else:
        raise ValueError(
            f"Unsupported file format: '{ext}'. "
            "Supported formats: .txt, .docx, .pdf"
        )


def _parse_txt(file_bytes: bytes) -> str:
    """Parse a plain text file. Tries UTF-8 then falls back to latin-1."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1")


def _parse_docx(file_bytes: bytes) -> str:
    """
    Parse a .docx file using python-docx.
    Extracts all paragraph text in reading order.
    """
    import io
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
    return "\n".join(paragraphs)


def _parse_pdf(file_bytes: bytes) -> str:
    """
    Parse a PDF file using PyMuPDF (fitz).
    Extracts text from all pages.
    """
    import fitz  # PyMuPDF

    pages_text = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for page in doc:
            pages_text.append(page.get_text())

    return "\n".join(pages_text)
