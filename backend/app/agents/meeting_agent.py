"""
meeting_agent.py — Meeting Agent (MAF / AutoGen)

Processes uploaded meeting transcripts and extracts structured insights.

Responsibilities:
  - Read meeting transcript text (already parsed by document_parser)
  - Cross-reference with existing project tasks to prevent duplicates
  - Extract: completed tasks, new tasks, blockers, risks, decisions, deadlines
  - Return structured JSON — NEVER writes to MongoDB directly

The Meeting Agent is a pure extractor/transformer.
All persistence is delegated to the Project Agent via the Orchestrator.
"""

import json
import logging
from datetime import datetime, timezone

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


async def extract_meeting_insights(
    transcript_text: str,
    project_context: str = "",
    existing_tasks: list = None,
) -> dict:
    """
    Use the LLM to extract structured intelligence from a meeting transcript.

    Args:
        transcript_text: Full text of the meeting transcript.
        project_context: Optional brief description of the project for better context.
        existing_tasks:  List of dicts representing tasks currently existing in the project.

    Returns:
        Structured dict with keys:
          - completed_tasks: list[str]  — titles of existing tasks mentioned as done
          - new_tasks: list[dict]       — TRULY new tasks not in existing_tasks
          - blockers: list[str]         — blockers/impediments mentioned
          - risks: list[str]            — risks identified
          - decisions: list[str]        — decisions made in the meeting
          - deadlines: list[dict]       — deadlines with task and date
          - summary: str                — one-paragraph summary of the meeting
    """
    settings = get_settings()

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

    formatted_existing_tasks = ""
    if existing_tasks:
        lines = []
        for t in existing_tasks:
            title = t.get("title")
            if title:
                lines.append(f"- \"{title}\" (Module: {t.get('module', 'N/A')}, Status: {t.get('status', 'pending')})")
        if lines:
            formatted_existing_tasks = "EXISTING PROJECT TASKS IN DATABASE:\n" + "\n".join(lines)

    prompt = f"""You are an expert meeting analyst. Analyze the following meeting transcript and extract structured intelligence.

{"Project Description: " + project_context if project_context else ""}

{formatted_existing_tasks}

Meeting Transcript:
---
{transcript_text[:8000]}
---

CRITICAL INSTRUCTIONS FOR TASKS:
1. "completed_tasks": Look at the EXISTING PROJECT TASKS listed above and the transcript. If any existing task (or work matching an existing task) was mentioned as finished, completed, done, or resolved in the meeting, include its exact existing title in "completed_tasks".
2. "new_tasks": ONLY include action items that are TRULY NEW and DO NOT match any task in the EXISTING PROJECT TASKS list above. Do NOT duplicate existing tasks into "new_tasks"!

Extract and return a JSON object with EXACTLY this structure:
{{
  "completed_tasks": ["Exact title of existing task marked as completed", ...],
  "new_tasks": [
    {{
      "title": "New task title",
      "description": "What needs to be done",
      "module": "Module name if applicable",
      "priority": "High|Medium|Low",
      "status": "pending",
      "assigned_to": "Person name or null",
      "estimated_hours": null,
      "tags": []
    }}
  ],
  "blockers": ["Description of a blocker or impediment", ...],
  "risks": ["Description of a risk", ...],
  "decisions": ["A decision made in the meeting", ...],
  "deadlines": [
    {{
      "task": "Task or milestone name",
      "date": "YYYY-MM-DD or natural language date",
      "person": "Who is responsible"
    }}
  ],
  "summary": "A 2-3 sentence summary of what was discussed and decided."
}}

Return ONLY valid JSON. If a field has no data, return an empty list or null."""

    logger.info("MeetingAgent: Extracting insights from transcript...")
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    raw = response.choices[0].message.content
    insights = json.loads(raw)

    # Add processing metadata
    insights["processed_at"] = datetime.now(timezone.utc).isoformat()
    insights["transcript_length"] = len(transcript_text)

    logger.info(
        f"MeetingAgent: Extracted {len(insights.get('completed_tasks', []))} completed tasks, "
        f"{len(insights.get('new_tasks', []))} new tasks, "
        f"{len(insights.get('blockers', []))} blockers."
    )

    return insights
