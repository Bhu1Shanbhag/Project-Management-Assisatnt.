"""
orchestrator_agent.py — Orchestrator Agent (MAF / AutoGen)

The Orchestrator is the central routing hub for the platform.
It receives requests from FastAPI, decides which agent(s) should execute,
coordinates the workflow, and returns the final result.

Design Rule: The Orchestrator contains NO business logic.
It only routes, sequences, and aggregates agent outputs.

Supported workflows:
  1. create_project    → ProjectAgent → RAGAgent
  2. sync_github       → GitHubAgent  → ProjectAgent
  3. upload_meeting    → MeetingAgent → ProjectAgent → RAGAgent
  4. chat              → RAGAgent
  5. get_summary       → SummaryAgent

Future integrations (e.g., Whisper, Teams, Webhooks) can be added
as new workflow types here without touching the agent files.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class OrchestratorAgent:
    """
    The central coordinator for the AI Project Intelligence Platform.

    Routes incoming workflow requests to the appropriate specialist agents
    and returns the consolidated result back to the FastAPI layer.
    """

    async def run(self, workflow: str, payload: dict) -> dict:
        """
        Execute a named workflow by routing to the correct agent(s).

        Args:
            workflow: One of the supported workflow names (see module docstring).
            payload:  Workflow-specific data dictionary.

        Returns:
            Result dict from the agent(s).

        Raises:
            ValueError: If the workflow name is not recognized.
        """
        logger.info(f"Orchestrator: Starting workflow='{workflow}'")

        handlers = {
            "create_project": self._workflow_create_project,
            "sync_github": self._workflow_sync_github,
            "upload_meeting": self._workflow_upload_meeting,
            "chat": self._workflow_chat,
            "get_summary": self._workflow_get_summary,
        }

        handler = handlers.get(workflow)
        if not handler:
            raise ValueError(
                f"Unknown workflow: '{workflow}'. "
                f"Supported: {list(handlers.keys())}"
            )

        result = await handler(payload)
        logger.info(f"Orchestrator: Workflow='{workflow}' completed successfully.")
        return result

    # ──────────────────────────────────────────────────────────────────────
    # Workflow: Create Project
    # Flow: ProjectAgent → RAGAgent (if documents provided)
    # ──────────────────────────────────────────────────────────────────────

    async def _workflow_create_project(self, payload: dict) -> dict:
        """
        Create a new project with AI-generated modules and tasks.
        Optionally ingest uploaded documents into ChromaDB.
        """
        from app.agents import project_agent, rag_agent

        project_data = payload.get("project_data", {})
        requirements_text = payload.get("requirements_text", "")
        doc_id = payload.get("document_id")

        # Step 1: ProjectAgent creates the project and generates structure
        result = await project_agent.create_project(
            project_data=project_data,
            requirements_text=requirements_text,
        )

        # Step 2: RAGAgent ingests the requirements document if provided
        if requirements_text and doc_id:
            chunk_count = await rag_agent.ingest_document(
                document_text=requirements_text,
                document_id=doc_id,
                project_id=result["project_id"],
                doc_type="requirements",
                metadata={"filename": payload.get("filename", "requirements")},
            )
            result["chunks_ingested"] = chunk_count

        return result

    # ──────────────────────────────────────────────────────────────────────
    # Workflow: GitHub Sync
    # Flow: GitHubAgent (fetch) → ProjectAgent (update MongoDB)
    # ──────────────────────────────────────────────────────────────────────

    async def _workflow_sync_github(self, payload: dict) -> dict:
        """
        Sync GitHub repository data and update project tasks/state.
        """
        from app.agents import github_agent, project_agent
        from app.config.database import get_database

        project_id = payload["project_id"]
        repo_url = payload["repo_url"]
        pat = payload["pat"]

        # Fetch current tasks for PR matching
        db = get_database()
        tasks = []
        try:
            tasks_cursor = db.tasks.find({"project_id": project_id})
            tasks = await tasks_cursor.to_list(length=200)
        except Exception as e:
            logger.warning(f"Failed to fetch tasks from MongoDB during sync: {e}")

        # Step 1: GitHubAgent fetches data
        github_data = await github_agent.fetch_repository_data(
            repo_url=repo_url,
            pat=pat,
            project_tasks=tasks,
        )

        # Step 2: ProjectAgent applies the updates to MongoDB
        await project_agent.update_project_from_github(
            project_id=project_id,
            github_updates=github_data,
        )

        return {
            "success": True,
            "commits_fetched": len(github_data.get("commits", [])),
            "prs_fetched": len(github_data.get("pull_requests", [])),
            "github_data": github_data,
        }

    # ──────────────────────────────────────────────────────────────────────
    # Workflow: Upload Meeting Transcript
    # Flow: MeetingAgent → ProjectAgent → RAGAgent
    # ──────────────────────────────────────────────────────────────────────

    async def _workflow_upload_meeting(self, payload: dict) -> dict:
        """
        Process a meeting transcript: extract insights, update project, ingest into RAG.
        """
        from app.agents import meeting_agent, project_agent, rag_agent
        from app.config.database import get_database
        from datetime import datetime, timezone

        project_id = payload["project_id"]
        transcript_text = payload["transcript_text"]
        filename = payload.get("filename", "transcript.txt")

        # Get project context & existing tasks for accurate LLM extraction
        db = get_database()
        from bson import ObjectId
        project = None
        existing_tasks = []

        try:
            if ObjectId.is_valid(project_id):
                project = await db.projects.find_one({"_id": ObjectId(project_id)})
                cursor = db.tasks.find({"project_id": project_id})
                existing_tasks = await cursor.to_list(length=500)
        except Exception:
            pass

        if not project:
            from app.agents.project_agent import _in_memory_projects, _in_memory_tasks
            project = _in_memory_projects.get(project_id)

        from app.agents.project_agent import _in_memory_tasks
        if project_id in _in_memory_tasks:
            for t in _in_memory_tasks[project_id]:
                t_id = t.get("id") or str(t.get("_id", ""))
                if not any((x.get("id") == t_id or str(x.get("_id", "")) == t_id) for x in existing_tasks):
                    existing_tasks.append(t)

        project_context = project.get("description", "") if project else ""

        # Step 1: MeetingAgent extracts structured insights
        insights = await meeting_agent.extract_meeting_insights(
            transcript_text=transcript_text,
            project_context=project_context,
            existing_tasks=existing_tasks,
        )

        # Step 2: Save meeting record to MongoDB (via ProjectAgent)
        meeting_record = {
            "project_id": project_id,
            "filename": filename,
            "date": datetime.now(timezone.utc).isoformat(),
            **insights,
        }
        insert_result = await db.meetings.insert_one(meeting_record)
        meeting_id = str(insert_result.inserted_id)

        # Step 3: ProjectAgent updates project state
        await project_agent.update_project_from_meeting(
            project_id=project_id,
            meeting_insights=insights,
        )

        # Step 4: RAGAgent ingests the transcript for future Q&A
        chunk_count = await rag_agent.ingest_document(
            document_text=transcript_text,
            document_id=meeting_id,
            project_id=project_id,
            doc_type="meeting",
            metadata={"filename": filename, "date": insights.get("processed_at", "")},
        )

        return {
            "success": True,
            "meeting_id": meeting_id,
            "insights": insights,
            "chunks_ingested": chunk_count,
        }

    # ──────────────────────────────────────────────────────────────────────
    # Workflow: AI Chat
    # Flow: RAGAgent retrieves context and answers the question
    # ──────────────────────────────────────────────────────────────────────

    async def _workflow_chat(self, payload: dict) -> dict:
        """
        Answer a user question using RAG-powered retrieval from the knowledge base.
        """
        from app.agents import rag_agent

        question = payload["question"]
        project_id = payload.get("project_id", "")

        answer = await rag_agent.query_knowledge(
            query=question,
            project_id=project_id,
        )

        return {
            "question": question,
            "answer": answer,
            "project_id": project_id,
        }

    # ──────────────────────────────────────────────────────────────────────
    # Workflow: Generate Summary
    # Flow: SummaryAgent reads MongoDB and generates report
    # ──────────────────────────────────────────────────────────────────────

    async def _workflow_get_summary(self, payload: dict) -> dict:
        """
        Generate an AI-powered project summary report.
        """
        from app.agents import summary_agent

        project_id = payload["project_id"]
        summary_type = payload.get("summary_type", "daily")

        summary = await summary_agent.generate_summary(
            project_id=project_id,
            summary_type=summary_type,
        )

        return summary


# Module-level singleton instance
orchestrator = OrchestratorAgent()
