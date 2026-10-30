"""
github_agent.py — GitHub Agent (MAF / AutoGen)

Connects to GitHub using a Personal Access Token (PAT) and retrieves
repository activity to track development progress.

Responsibilities:
  - Connect to a GitHub repository using PAT
  - Read recent commits
  - Read Pull Requests (open and merged)
  - Match Pull Requests to project tasks by title/branch analysis
  - Return structured updates — NEVER writes to MongoDB directly

All persistence is delegated to the Project Agent via the Orchestrator.

Future integrations: GitHub Webhooks can replace the manual sync
by pointing to a new /github/webhook endpoint.
"""

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


def _get_github_client(pat: str):
    """
    Create and return a PyGithub Github client using the provided PAT.

    Args:
        pat: GitHub Personal Access Token.

    Returns:
        github.Github instance.
    """
    from github import Github, Auth
    auth = Auth.Token(pat)
    return Github(auth=auth)


async def fetch_repository_data(
    repo_url: str,
    pat: str,
    project_tasks: Optional[list] = None,
    days_back: int = 30,
) -> dict:
    """
    Fetch commits and Pull Requests from a GitHub repository.

    Args:
        repo_url:      Full GitHub repository URL (e.g., https://github.com/org/repo)
        pat:           GitHub Personal Access Token.
        project_tasks: Optional list of task dicts for PR matching.
        days_back:     How many days back to fetch commits (default 30).

    Returns:
        Structured dict with:
          - commits: list of recent commit summaries
          - pull_requests: list of PR summaries with task matching
          - repo_info: basic repo metadata
    """
    # Extract owner/repo from URL
    match = re.search(r"github\.com[/:]([^/]+)/([^/\s]+?)(?:\.git)?$", repo_url.strip())
    if not match:
        raise ValueError(f"Invalid GitHub URL: {repo_url}")

    owner = match.group(1)
    repo_name = match.group(2)

    logger.info(f"GitHubAgent: Fetching data from {owner}/{repo_name}")

    # Run synchronously (PyGithub is sync; running in FastAPI async context is fine
    # since this is I/O-bound and we keep it lightweight for MVP)
    import asyncio
    from github import GithubException
    try:
        result = await asyncio.to_thread(
            _fetch_data_sync, owner, repo_name, pat, project_tasks, days_back
        )
    except GithubException as e:
        status = e.status
        if status == 404:
            raise ValueError(
                f"Repository '{owner}/{repo_name}' not found. "
                "Check that the repo exists and your PAT has 'repo' scope access to it."
            )
        elif status == 401:
            raise ValueError(
                "GitHub authentication failed. Your Personal Access Token (PAT) is invalid or expired."
            )
        else:
            raise ValueError(f"GitHub API error {status}: {e.data.get('message', str(e))}")
    return result


def _fetch_data_sync(
    owner: str,
    repo_name: str,
    pat: str,
    project_tasks: Optional[list],
    days_back: int,
) -> dict:
    """
    Synchronous GitHub data fetch (runs in thread pool via asyncio.to_thread).
    """
    gh = _get_github_client(pat)
    repo = gh.get_repo(f"{owner}/{repo_name}")

    since = datetime.now(timezone.utc) - timedelta(days=days_back)

    # ── Commits ───────────────────────────────────────────────────────────
    commits_data = []
    try:
        commits = repo.get_commits(since=since)
        for commit in list(commits)[:50]:  # Cap at 50 for performance
            commits_data.append({
                "sha": commit.sha[:8],
                "message": commit.commit.message.split("\n")[0],  # first line only
                "author": commit.commit.author.name,
                "date": commit.commit.author.date.isoformat(),
                "url": commit.html_url,
            })
    except Exception as e:
        logger.warning(f"GitHubAgent: Could not fetch commits: {e}")

    # ── Pull Requests ─────────────────────────────────────────────────────
    prs_data = []
    try:
        # Fetch open and recently merged PRs
        for state in ["open", "closed"]:
            prs = repo.get_pulls(state=state, sort="updated", direction="desc")
            for pr in list(prs)[:20]:  # Cap at 20 per state
                # Skip old closed PRs
                if state == "closed" and pr.merged_at:
                    if pr.merged_at.replace(tzinfo=timezone.utc) < since:
                        continue

                matched_task = _match_pr_to_task(pr.title, pr.head.ref, project_tasks)

                prs_data.append({
                    "number": pr.number,
                    "title": pr.title,
                    "state": pr.state,
                    "author": pr.user.login,
                    "branch": pr.head.ref,
                    "url": pr.html_url,
                    "created_at": pr.created_at.isoformat(),
                    "merged_at": pr.merged_at.isoformat() if pr.merged_at else None,
                    "matched_task_title": matched_task,
                    "labels": [label.name for label in pr.labels],
                })
    except Exception as e:
        logger.warning(f"GitHubAgent: Could not fetch PRs: {e}")

    # ── Repository Info ───────────────────────────────────────────────────
    repo_info = {
        "name": repo.name,
        "full_name": repo.full_name,
        "description": repo.description,
        "default_branch": repo.default_branch,
        "open_issues": repo.open_issues_count,
        "stars": repo.stargazers_count,
        "url": repo.html_url,
    }

    logger.info(
        f"GitHubAgent: Retrieved {len(commits_data)} commits, "
        f"{len(prs_data)} PRs from {owner}/{repo_name}"
    )

    return {
        "commits": commits_data,
        "pull_requests": prs_data,
        "repo_info": repo_info,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


def _match_pr_to_task(pr_title: str, branch_name: str, tasks: Optional[list]) -> Optional[str]:
    """
    Attempt to match a PR title/branch to a project task by fuzzy keyword matching.

    Args:
        pr_title:   PR title string.
        branch_name: Git branch name.
        tasks:       List of task dicts from the project.

    Returns:
        Matched task title string, or None if no match found.
    """
    if not tasks:
        return None

    pr_lower = pr_title.lower()
    branch_lower = branch_name.lower()

    for task in tasks:
        task_title = task.get("title", "").lower()
        # Simple keyword overlap check
        task_keywords = set(re.split(r"\W+", task_title)) - {"the", "a", "an", "and", "or", "for"}
        for keyword in task_keywords:
            if len(keyword) > 3 and (keyword in pr_lower or keyword in branch_lower):
                return task.get("title")

    return None
