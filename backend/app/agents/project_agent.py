"""
project_agent.py — Project Agent (MAF / AutoGen)

The Project Agent is the SINGLE SOURCE OF TRUTH for project data.
It is the ONLY agent allowed to read from and write to MongoDB.

Responsibilities:
  - Create new projects
  - Analyze project descriptions and generate modules/features
  - Generate initial task lists from requirements
  - Receive structured updates from other agents (Meeting, GitHub)
  - Update project state, progress, and health metrics
  - Persist all changes to MongoDB

This agent is implemented using Microsoft Agent Framework (AutoGen AgentChat).
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from bson import ObjectId
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient, AzureOpenAIChatCompletionClient
from autogen_agentchat.messages import TextMessage
from autogen_core import CancellationToken

from app.config.settings import get_settings
from app.config.database import get_database

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Shared model client factory
# ─────────────────────────────────────────────────────────────────────────────

def _build_model_client():
    """Build the appropriate model client based on LLM_PROVIDER setting."""
    settings = get_settings()

    if settings.LLM_PROVIDER == "azure":
        return AzureOpenAIChatCompletionClient(
            azure_deployment=settings.AZURE_OPENAI_DEPLOYMENT,
            model=settings.AZURE_OPENAI_DEPLOYMENT,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY,
        )
    else:
        return OpenAIChatCompletionClient(
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Agent Tool Functions
# All functions below are registered as tools on the AssistantAgent.
# They perform the actual business logic and database operations.
# ─────────────────────────────────────────────────────────────────────────────

async def analyze_and_generate_structure(
    project_description: str,
    requirements_text: str = "",
) -> str:
    """
    Analyze the project description and requirements, then generate:
      - A list of high-level modules
      - An initial task list for each module

    Args:
        project_description: Free-text description of the project.
        requirements_text:   Optional content from an uploaded requirements doc.

    Returns:
        JSON string with keys: modules (list), tasks (list of task dicts).
    """
    settings = get_settings()
    model_client = _build_model_client()

    # Use the model directly for a focused generation task
    from openai import AsyncOpenAI, AsyncAzureOpenAI

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

    prompt = f"""You are a senior software architect. Analyze the following project description and generate a structured breakdown.

Project Description:
{project_description}

{"Requirements Document:" if requirements_text else ""}
{requirements_text[:3000] if requirements_text else ""}

Generate a JSON response with this exact structure:
{{
  "modules": [
    {{
      "name": "Module Name",
      "description": "What this module does",
      "priority": "High|Medium|Low"
    }}
  ],
  "tasks": [
    {{
      "title": "Task title",
      "description": "What needs to be done",
      "module": "Module Name",
      "priority": "High|Medium|Low",
      "estimated_hours": 4,
      "status": "pending",
      "tags": ["backend", "api"]
    }}
  ]
}}

Generate 4-8 modules and 10-20 tasks. Return ONLY valid JSON."""

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        await model_client.close()
        return response.choices[0].message.content
    except Exception as e:
        logger.warning(f"LLM project structure generation failed ({e}); returning fallback template.")
        try:
            await model_client.close()
        except Exception:
            pass
        fallback = {
            "modules": [
                {"name": "Core Architecture & Backend", "description": "Core API and database setup", "priority": "High"},
                {"name": "User Interface & Workflows", "description": "Frontend UI components and user journeys", "priority": "High"},
                {"name": "Integrations & Automation", "description": "Third-party services and automated pipelines", "priority": "Medium"}
            ],
            "tasks": [
                {"title": "Initialize Database & Schemas", "description": "Set up database schemas and models", "module": "Core Architecture & Backend", "priority": "High", "estimated_hours": 4, "status": "pending", "tags": ["backend", "database"]},
                {"title": "Implement Auth & User Management", "description": "JWT authentication and user endpoints", "module": "Core Architecture & Backend", "priority": "High", "estimated_hours": 6, "status": "pending", "tags": ["backend", "security"]},
                {"title": "Build Project Dashboard UI", "description": "Main layout, metrics, and project navigation", "module": "User Interface & Workflows", "priority": "High", "estimated_hours": 8, "status": "pending", "tags": ["frontend", "ui"]},
                {"title": "Setup CI/CD Pipeline", "description": "Automated build and test workflows", "module": "Integrations & Automation", "priority": "Medium", "estimated_hours": 4, "status": "pending", "tags": ["devops"]}
            ]
        }
        return json.dumps(fallback)


_in_memory_projects = {}
_in_memory_tasks = {}


async def save_project_to_db(project_data: dict) -> str:
    """
    Save a new project document to MongoDB (or in-memory store on DB failure).
    """
    project_data["created_at"] = datetime.now(timezone.utc)
    project_data["updated_at"] = datetime.now(timezone.utc)
    project_data["health"] = "good"
    project_data["progress"] = 0

    settings = get_settings()
    if project_data.get("github_repo_url"):
        project_data["github_connected"] = True
        if not project_data.get("github_pat") and settings.GITHUB_PAT:
            project_data["github_pat"] = settings.GITHUB_PAT

    try:
        db = get_database()
        result = await db.projects.insert_one(project_data)
        project_id = str(result.inserted_id)
        if "_id" in project_data:
            project_data["_id"] = str(project_data["_id"])
        logger.info(f"Project saved to MongoDB with id: {project_id}")
        return project_id
    except Exception as e:
        logger.warning(f"MongoDB insert failed ({e}); saving to in-memory fallback.")
        project_id = f"proj_{uuid4().hex[:12]}"
        project_data["_id"] = project_id
        project_data["id"] = project_id
        _in_memory_projects[project_id] = project_data
        return project_id


async def save_tasks_to_db(project_id: str, tasks: list[dict]) -> int:
    """
    Save a list of tasks to MongoDB, linked to a project (or in-memory fallback).
    """
    for task in tasks:
        task["project_id"] = project_id
        task["created_at"] = datetime.now(timezone.utc)
        task["updated_at"] = datetime.now(timezone.utc)
        if "id" not in task:
            task["id"] = f"task_{uuid4().hex[:8]}"

    if not tasks:
        return 0

    try:
        db = get_database()
        result = await db.tasks.insert_many(tasks)
        count = len(result.inserted_ids)
        for task in tasks:
            if "_id" in task:
                task["_id"] = str(task["_id"])
        logger.info(f"Inserted {count} tasks into MongoDB for project {project_id}")
        return count
    except Exception as e:
        logger.warning(f"MongoDB task insert failed ({e}); saving to in-memory fallback.")
        if project_id not in _in_memory_tasks:
            _in_memory_tasks[project_id] = []
        _in_memory_tasks[project_id].extend(tasks)
        return len(tasks)


async def update_project_from_github(project_id: str, github_updates: dict) -> bool:
    """
    Apply structured GitHub updates (PRs, commits) to the project state.
    Called by the Orchestrator after GitHubAgent returns data.

    Args:
        project_id:     The project's MongoDB _id string.
        github_updates: Structured dict from GitHubAgent containing PR/commit info.

    Returns:
        True if update succeeded.
    """
    db = get_database()

    try:
        # Update tasks that have matching PR/branch references
        pr_list = github_updates.get("pull_requests", [])
        for pr in pr_list:
            if pr.get("matched_task_title"):
                # Determine task status based on PR state:
                # merged PR → completed | open PR → in_progress
                if pr.get("merged_at"):
                    task_status = "completed"
                elif pr.get("state") == "open":
                    task_status = "in_progress"
                else:
                    task_status = None  # closed but not merged (e.g. rejected) — leave status unchanged

                update_fields = {
                    "github_pr_url": pr.get("url"),
                    "github_pr_state": pr.get("state"),
                    "updated_at": datetime.now(timezone.utc),
                }
                if task_status:
                    update_fields["status"] = task_status

                await db.tasks.update_many(
                    {
                        "project_id": project_id,
                        "title": {"$regex": pr["matched_task_title"], "$options": "i"},
                    },
                    {"$set": update_fields},
                )
                logger.info(
                    f"ProjectAgent: PR #{pr.get('number')} matched task "
                    f"'{pr['matched_task_title']}' → status set to '{task_status or 'unchanged'}'"
                )

        # Recalculate and update project progress
        await _recalculate_progress(project_id)

        if ObjectId.is_valid(project_id):
            await db.projects.update_one(
                {"_id": ObjectId(project_id)},
                {
                    "$set": {
                        "last_github_sync": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
        logger.info(f"Project {project_id} updated with GitHub data.")
    except Exception as e:
        logger.warning(f"ProjectAgent: MongoDB update failed during GitHub sync ({e}).")
    return True


def _normalize_title(text: str) -> str:
    """Normalize task title by lowercasing and stripping non-alphanumeric chars."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    return " ".join(text.split())


def _is_similar_title(t1: str, t2: str, threshold: float = 0.5) -> bool:
    """Determine if two task titles refer to the same task using token overlap & substring matching."""
    n1 = _normalize_title(t1)
    n2 = _normalize_title(t2)
    if not n1 or not n2:
        return False
    if n1 == n2 or n1 in n2 or n2 in n1:
        return True

    words1 = set(n1.split())
    words2 = set(n2.split())

    stopwords = {"a", "an", "the", "and", "or", "to", "for", "of", "in", "on", "with", "is", "be", "task", "implement", "add", "create", "update", "setup"}
    w1 = words1 - stopwords
    w2 = words2 - stopwords

    if not w1 or not w2:
        return words1 == words2

    intersection = w1.intersection(w2)
    min_size = min(len(w1), len(w2))
    if min_size > 0 and (len(intersection) / min_size) >= threshold:
        return True
    return False


async def update_project_from_meeting(project_id: str, meeting_insights: dict) -> bool:
    """
    Apply extracted meeting insights to the project.
    Deduplicates tasks and marks completed tasks reliably across MongoDB and in-memory stores.
    """
    db = get_database()

    # 1. Fetch all current tasks for this project
    existing_tasks = []
    try:
        if ObjectId.is_valid(project_id):
            cursor = db.tasks.find({"project_id": project_id})
            existing_tasks = await cursor.to_list(length=500)
    except Exception:
        pass

    if project_id in _in_memory_tasks:
        for t in _in_memory_tasks[project_id]:
            t_id = t.get("id") or str(t.get("_id", ""))
            if not any((x.get("id") == t_id or str(x.get("_id", "")) == t_id) for x in existing_tasks):
                existing_tasks.append(t)

    completed_titles = meeting_insights.get("completed_tasks", [])

    # 2. Mark matching tasks as completed
    for comp_title in completed_titles:
        for task in existing_tasks:
            task_title = task.get("title", "")
            if _is_similar_title(comp_title, task_title):
                task_id = task.get("_id") or task.get("id")
                try:
                    if isinstance(task_id, ObjectId) or (isinstance(task_id, str) and ObjectId.is_valid(task_id)):
                        await db.tasks.update_one(
                            {"_id": ObjectId(task_id)},
                            {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc)}}
                        )
                except Exception:
                    pass
                task["status"] = "completed"
                if project_id in _in_memory_tasks:
                    for mem_t in _in_memory_tasks[project_id]:
                        if _is_similar_title(comp_title, mem_t.get("title", "")):
                            mem_t["status"] = "completed"

    # 3. Add truly NEW tasks (filtering out any task similar to existing tasks)
    raw_new_tasks = meeting_insights.get("new_tasks", [])
    truly_new_tasks = []

    for new_t in raw_new_tasks:
        new_title = new_t.get("title", "")
        is_duplicate = any(_is_similar_title(new_title, ext.get("title", "")) for ext in existing_tasks)
        if not is_duplicate:
            truly_new_tasks.append(new_t)
            existing_tasks.append(new_t)
        else:
            logger.info(f"Filtered out duplicate meeting task: '{new_title}'")

    if truly_new_tasks:
        await save_tasks_to_db(project_id, truly_new_tasks)

    # 4. Store blockers & decisions
    blockers = meeting_insights.get("blockers", [])
    decisions = meeting_insights.get("decisions", [])

    try:
        if ObjectId.is_valid(project_id):
            await db.projects.update_one(
                {"_id": ObjectId(project_id)},
                {
                    "$set": {
                        "blockers": blockers,
                        "latest_decisions": decisions,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
    except Exception:
        pass

    if project_id in _in_memory_projects:
        _in_memory_projects[project_id]["blockers"] = blockers
        _in_memory_projects[project_id]["latest_decisions"] = decisions

    await _recalculate_progress(project_id)
    logger.info(f"Project {project_id} updated with meeting insights cleanly.")
    return True


async def _recalculate_progress(project_id: str) -> None:
    """
    Recalculate project completion percentage and health status.
    Updates the project document in-place.
    """
    total = 0
    completed = 0
    blocker_count = 0

    try:
        db = get_database()
        if ObjectId.is_valid(project_id):
            total = await db.tasks.count_documents({"project_id": project_id})
            completed = await db.tasks.count_documents(
                {"project_id": project_id, "status": "completed"}
            )
            blockers_doc = await db.projects.find_one(
                {"_id": ObjectId(project_id)}, {"blockers": 1}
            )
            blocker_count = len(blockers_doc.get("blockers", [])) if blockers_doc else 0

            progress = int((completed / total) * 100) if total > 0 else 0
            if blocker_count > 3:
                health = "at_risk"
            elif blocker_count > 1:
                health = "needs_attention"
            else:
                health = "good"

            await db.projects.update_one(
                {"_id": ObjectId(project_id)},
                {"$set": {"progress": progress, "health": health}},
            )
    except Exception:
        pass

    if project_id in _in_memory_projects:
        mem_tasks = _in_memory_tasks.get(project_id, [])
        total_m = len(mem_tasks)
        completed_m = len([t for t in mem_tasks if t.get("status") == "completed"])
        prog_m = int((completed_m / total_m) * 100) if total_m > 0 else 0
        _in_memory_projects[project_id]["progress"] = prog_m


# ─────────────────────────────────────────────────────────────────────────────
# High-level orchestration functions (called directly by the Orchestrator)
# ─────────────────────────────────────────────────────────────────────────────

async def create_project(
    project_data: dict,
    requirements_text: str = "",
) -> dict:
    """
    Full project creation workflow:
      1. Generate modules and tasks using the LLM
      2. Save project to MongoDB
      3. Save generated tasks to MongoDB

    Args:
        project_data:      Form data submitted by the user (name, description, etc.)
        requirements_text: Parsed content from uploaded requirements doc.

    Returns:
        Dict with project_id, modules, and tasks.
    """
    logger.info(f"ProjectAgent: Creating project '{project_data.get('name')}'")

    # Step 1: AI-generate project structure
    structure_json = await analyze_and_generate_structure(
        project_description=project_data.get("description", ""),
        requirements_text=requirements_text,
    )
    structure = json.loads(structure_json)

    # Step 2: Save project (without tasks)
    project_record = {
        **project_data,
        "modules": structure.get("modules", []),
        "status": "active",
    }
    project_id = await save_project_to_db(project_record)

    # Step 3: Save generated tasks
    tasks = structure.get("tasks", [])
    task_count = await save_tasks_to_db(project_id, tasks)

    logger.info(
        f"ProjectAgent: Project '{project_data.get('name')}' created. "
        f"ID={project_id}, Tasks={task_count}"
    )

    return {
        "project_id": project_id,
        "modules": structure.get("modules", []),
        "tasks": tasks,
        "task_count": task_count,
    }
