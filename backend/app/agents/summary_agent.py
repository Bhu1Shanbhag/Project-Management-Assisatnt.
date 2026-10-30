"""
summary_agent.py — Summary Agent (MAF / AutoGen)

Generates comprehensive AI-powered project reports from the current project state.

Responsibilities:
  - Read project data, tasks, meetings from MongoDB
  - Generate: Daily / Weekly / Sprint / Executive / Health summaries
  - Return structured summary with sections, metrics, and recommendations

The Summary Agent is READ-ONLY — it never modifies MongoDB.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId

from app.config.settings import get_settings
from app.config.database import get_database

logger = logging.getLogger(__name__)

# Valid summary types
SUMMARY_TYPES = ["daily", "weekly", "sprint", "executive", "health"]


async def generate_summary(
    project_id: str,
    summary_type: str = "daily",
) -> dict:
    """
    Generate a comprehensive AI summary for a project.

    Args:
        project_id:   MongoDB _id of the project.
        summary_type: One of: daily, weekly, sprint, executive, health.

    Returns:
        Dict with summary text, key metrics, and metadata.
    """
    if summary_type not in SUMMARY_TYPES:
        raise ValueError(f"Invalid summary type. Must be one of: {SUMMARY_TYPES}")

    settings = get_settings()
    db = get_database()

    logger.info(f"SummaryAgent: Generating '{summary_type}' summary for project {project_id}")

    # ── Gather project state from MongoDB ────────────────────────────────
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise ValueError(f"Project {project_id} not found.")

    # Fetch tasks
    tasks_cursor = db.tasks.find({"project_id": project_id})
    tasks = await tasks_cursor.to_list(length=500)

    # Fetch recent meetings (last 7 days for daily/weekly, all for sprint/executive)
    meeting_since = _get_since_date(summary_type)
    meetings_cursor = db.meetings.find({
        "project_id": project_id,
        "processed_at": {"$gte": meeting_since.isoformat()},
    }).sort("processed_at", -1)
    meetings = await meetings_cursor.to_list(length=20)

    # Compute task metrics
    task_metrics = _compute_task_metrics(tasks)

    # ── Build context for LLM ────────────────────────────────────────────
    context = _build_summary_context(project, tasks, meetings, task_metrics)

    # ── Generate AI summary ──────────────────────────────────────────────
    summary_text = await _call_llm_for_summary(context, summary_type, settings)

    # ── Build final summary document ─────────────────────────────────────
    summary_doc = {
        "project_id": project_id,
        "project_name": project.get("name"),
        "summary_type": summary_type,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "content": summary_text,
        "metrics": task_metrics,
        "health": project.get("health", "good"),
        "progress": project.get("progress", 0),
        "blockers": project.get("blockers", []),
        "latest_decisions": project.get("latest_decisions", []),
    }

    # Save summary to MongoDB for history
    await db.summaries.insert_one({**summary_doc})

    logger.info(f"SummaryAgent: '{summary_type}' summary generated and saved.")
    return summary_doc


def _get_since_date(summary_type: str) -> datetime:
    """Return the appropriate lookback date for each summary type."""
    now = datetime.now(timezone.utc)
    if summary_type == "daily":
        return now - timedelta(days=1)
    elif summary_type == "weekly":
        return now - timedelta(days=7)
    elif summary_type == "sprint":
        return now - timedelta(days=14)
    else:  # executive, health
        return now - timedelta(days=90)


def _compute_task_metrics(tasks: list) -> dict:
    """Calculate task completion and status breakdown metrics."""
    total = len(tasks)
    if total == 0:
        return {
            "total": 0, "completed": 0, "in_progress": 0,
            "pending": 0, "blocked": 0, "completion_rate": 0,
        }

    by_status = {"completed": 0, "in_progress": 0, "pending": 0, "blocked": 0}
    by_priority = {"High": 0, "Medium": 0, "Low": 0}

    for task in tasks:
        status = task.get("status", "pending")
        if status in by_status:
            by_status[status] += 1
        else:
            by_status["pending"] += 1

        priority = task.get("priority", "Medium")
        if priority in by_priority:
            by_priority[priority] += 1

    return {
        "total": total,
        **by_status,
        "completion_rate": round((by_status["completed"] / total) * 100, 1),
        "by_priority": by_priority,
    }


def _build_summary_context(
    project: dict,
    tasks: list,
    meetings: list,
    metrics: dict,
) -> str:
    """Build a compact text context for the LLM summary generation."""
    lines = [
        f"PROJECT: {project.get('name')} (Client: {project.get('client_name', 'N/A')})",
        f"Description: {project.get('description', '')}",
        f"Status: {project.get('status', 'active')} | Health: {project.get('health', 'good')}",
        f"Progress: {project.get('progress', 0)}%",
        f"Start: {project.get('start_date', 'N/A')} | End: {project.get('end_date', 'N/A')}",
        "",
        "TASK METRICS:",
        f"  Total: {metrics['total']} | Completed: {metrics['completed']} | "
        f"In Progress: {metrics['in_progress']} | Pending: {metrics['pending']} | "
        f"Blocked: {metrics['blocked']}",
        f"  Completion Rate: {metrics['completion_rate']}%",
        "",
    ]

    # Current blockers
    blockers = project.get("blockers", [])
    if blockers:
        lines.append("BLOCKERS:")
        for b in blockers[:5]:
            lines.append(f"  - {b}")
        lines.append("")

    # Recent tasks by status
    in_progress = [t for t in tasks if t.get("status") == "in_progress"][:5]
    if in_progress:
        lines.append("IN-PROGRESS TASKS:")
        for t in in_progress:
            lines.append(f"  - [{t.get('priority','M')}] {t.get('title')}")
        lines.append("")

    # Recent meeting decisions
    if meetings:
        lines.append("RECENT MEETING INSIGHTS:")
        for meeting in meetings[:3]:
            lines.append(f"  Meeting on {meeting.get('date', 'N/A')}:")
            for d in meeting.get("decisions", [])[:3]:
                lines.append(f"    Decision: {d}")
            for r in meeting.get("risks", [])[:2]:
                lines.append(f"    Risk: {r}")
        lines.append("")

    return "\n".join(lines)


async def _call_llm_for_summary(context: str, summary_type: str, settings) -> str:
    """Call the LLM to generate the formatted summary."""
    if settings.LLM_PROVIDER == "azure":
        from openai import AsyncAzureOpenAI
        client = AsyncAzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        )
        model = settings.AZURE_OPENAI_DEPLOYMENT
    else:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        model = settings.OPENAI_MODEL

    type_instructions = {
        "daily": "Write a concise daily standup summary covering: what was accomplished, what's in progress, and any blockers.",
        "weekly": "Write a weekly progress report with achievements, upcoming priorities, risks, and team velocity observations.",
        "sprint": "Write a sprint review summary covering sprint goals completion, velocity, technical debt, and next sprint recommendations.",
        "executive": "Write an executive summary highlighting overall project health, business milestones, risks, and strategic recommendations.",
        "health": "Write a project health report assessing timeline adherence, team productivity, technical risks, and providing a RAG (Red/Amber/Green) status with actionable recommendations.",
    }

    prompt = f"""You are a senior project manager. Based on the following project data, generate a professional {summary_type} report.

Project Data:
{context}

Instructions: {type_instructions.get(summary_type, type_instructions["daily"])}

Format the report with clear sections using markdown headings. Be specific, data-driven, and actionable.
Keep the tone professional and constructive."""

    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=1500,
    )

    return response.choices[0].message.content
