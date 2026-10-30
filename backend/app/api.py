"""
api.py — FastAPI API Endpoints

All API endpoints for the AI Project Intelligence Platform.
Follows RESTful conventions and delegates business logic to the Orchestrator Agent.

Endpoints:
  Auth:     POST /register, POST /login
  Projects: POST/GET /projects, GET/PUT /projects/{id}
  Docs:     POST /projects/{id}/documents
  GitHub:   POST /github/connect, POST /github/sync
  Meetings: POST /meetings/upload
  Chat:     POST /chat
  Summary:  GET /summary/{project_id}
  Health:   GET /health
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr

from app.agents.orchestrator_agent import orchestrator
from app.config.database import get_database
from app.config.settings import get_settings
from app.services.document_parser import parse_document

logger = logging.getLogger(__name__)
router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Auth helpers
# ─────────────────────────────────────────────────────────────────────────────

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


def _hash_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        pw_bytes = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
    except Exception:
        return False


def _create_token(user_id: str, email: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


_in_memory_users = {}


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Dependency: validate JWT and return the current user document."""
    settings = get_settings()
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email", "")
        if not user_id:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    try:
        db = get_database()
        if ObjectId.is_valid(user_id):
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                return user
    except Exception:
        pass

    if user_id in _in_memory_users:
        return _in_memory_users[user_id]

    return {"_id": user_id, "id": user_id, "name": email.split("@")[0] if email else "User", "email": email}


def _serialize(doc: Any) -> Any:
    """Recursively convert MongoDB document / dicts / lists with ObjectIds or datetimes to JSON-serializable types."""
    if doc is None:
        return {}
    if isinstance(doc, list):
        return [_serialize(item) for item in doc]
    if isinstance(doc, dict):
        res = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                res[key] = str(value)
            elif isinstance(value, (dict, list)):
                res[key] = _serialize(value)
            elif isinstance(value, datetime):
                res[key] = value.isoformat()
            else:
                res[key] = value
        if "_id" in res:
            res["id"] = str(res["_id"])
        return res
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProjectCreateRequest(BaseModel):
    name: str
    client_name: str
    description: str
    team_members: list[str] = []
    start_date: str
    end_date: str
    github_repo_url: Optional[str] = None
    github_pat: Optional[str] = None


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    health: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    team_members: Optional[list[str]] = None
    github_repo_url: Optional[str] = None
    github_pat: Optional[str] = None


class GitHubConnectRequest(BaseModel):
    project_id: str
    repo_url: str
    pat: str


class ChatRequest(BaseModel):
    question: str
    project_id: Optional[str] = ""


class TaskCreateRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    module: Optional[str] = ""
    priority: Optional[str] = "Medium"
    status: Optional[str] = "pending"
    estimated_hours: Optional[int] = 0


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    estimated_hours: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201, tags=["Auth"])
async def register(body: RegisterRequest):
    """Register a new user account."""
    existing = None
    try:
        db = get_database()
        existing = await db.users.find_one({"email": body.email})
    except Exception:
        pass

    if not existing:
        for u in _in_memory_users.values():
            if u.get("email") == body.email:
                existing = u
                break

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    pw_hash = _hash_password(body.password)
    user_doc = {
        "name": body.name,
        "email": body.email,
        "password_hash": pw_hash,
        "created_at": datetime.now(timezone.utc),
    }

    user_id = None
    try:
        db = get_database()
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
    except Exception as e:
        logger.warning(f"MongoDB user insert failed ({e}); using fallback.")
        user_id = f"usr_{uuid4().hex[:12]}"
        user_doc["_id"] = user_id
        user_doc["id"] = user_id
        _in_memory_users[user_id] = user_doc

    token = _create_token(user_id, body.email)

    return {"token": token, "user": {"id": user_id, "name": body.name, "email": body.email}}


@router.post("/login", tags=["Auth"])
async def login(body: LoginRequest):
    """Authenticate and return a JWT token."""
    user = None
    try:
        db = get_database()
        user = await db.users.find_one({"email": body.email})
    except Exception:
        pass

    if not user:
        for u in _in_memory_users.values():
            if u.get("email") == body.email:
                user = u
                break

    if not user or not _verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_id = str(user.get("_id") or user.get("id"))
    token = _create_token(user_id, body.email)

    return {
        "token": token,
        "user": {"id": user_id, "name": user.get("name"), "email": user.get("email")},
    }


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/projects", status_code=201, tags=["Projects"])
async def create_project(
    body: ProjectCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new project. The Orchestrator delegates to ProjectAgent to
    analyze the description, generate modules and tasks, and persist to MongoDB.
    """
    project_data = body.model_dump()
    project_data["owner_id"] = str(current_user["_id"])

    try:
        result = await orchestrator.run("create_project", {
            "project_data": project_data,
            "requirements_text": "",
        })
        return _serialize(result)
    except Exception as e:
        logger.exception(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.get("/projects", tags=["Projects"])
async def list_projects(current_user: dict = Depends(get_current_user)):
    """Return all projects owned by the current user."""
    owner_id = str(current_user["_id"])
    projects = []
    try:
        db = get_database()
        cursor = db.projects.find({"owner_id": owner_id}).sort("created_at", -1)
        projects = await cursor.to_list(length=100)
    except Exception:
        pass

    from app.agents.project_agent import _in_memory_projects
    for pid, p in _in_memory_projects.items():
        if p.get("owner_id") == owner_id or not p.get("owner_id"):
            if not any(str(x.get("_id", "")) == pid for x in projects):
                projects.append(p)

    return [_serialize(p) for p in projects]


@router.get("/projects/{project_id}", tags=["Projects"])
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a single project with its tasks, meetings, and recent GitHub data."""
    project = None
    tasks = []
    meetings = []

    try:
        db = get_database()
        if ObjectId.is_valid(project_id):
            project = await db.projects.find_one({"_id": ObjectId(project_id)})
            if project:
                tasks_cursor = db.tasks.find({"project_id": project_id}).sort("created_at", 1)
                tasks = await tasks_cursor.to_list(length=500)
                meetings_cursor = db.meetings.find({"project_id": project_id}).sort("date", -1).limit(5)
                meetings = await meetings_cursor.to_list(length=5)
    except Exception:
        pass

    if not project:
        from app.agents.project_agent import _in_memory_projects, _in_memory_tasks
        project = _in_memory_projects.get(project_id)
        if project:
            tasks = _in_memory_tasks.get(project_id, [])

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    return {
        **_serialize(project),
        "tasks": [_serialize(t) for t in tasks],
        "meetings": [_serialize(m) for m in meetings],
    }


@router.put("/projects/{project_id}", tags=["Projects"])
async def update_project(
    project_id: str,
    body: ProjectUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update project metadata fields."""
    from app.agents.project_agent import _in_memory_projects

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)

    updated = False
    try:
        db = get_database()
        if ObjectId.is_valid(project_id):
            result = await db.projects.update_one(
                {"_id": ObjectId(project_id)},
                {"$set": update_data},
            )
            if result.matched_count > 0:
                updated = True
    except Exception:
        pass

    if project_id in _in_memory_projects:
        _in_memory_projects[project_id].update(update_data)
        updated = True

    if not updated:
        raise HTTPException(status_code=404, detail="Project not found.")

    return {"success": True, "updated_fields": list(update_data.keys())}


@router.delete("/projects/{project_id}", tags=["Projects"])
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a project and all associated tasks and meetings."""
    from app.agents.project_agent import _in_memory_projects, _in_memory_tasks
    deleted = False

    try:
        db = get_database()
        if ObjectId.is_valid(project_id):
            res = await db.projects.delete_one({"_id": ObjectId(project_id)})
            if res.deleted_count > 0:
                deleted = True
            await db.tasks.delete_many({"project_id": project_id})
            await db.meetings.delete_many({"project_id": project_id})
    except Exception:
        pass

    if project_id in _in_memory_projects:
        _in_memory_projects.pop(project_id, None)
        _in_memory_tasks.pop(project_id, None)
        deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found or already deleted.")

    return {"success": True, "message": f"Project {project_id} deleted."}


# ─────────────────────────────────────────────────────────────────────────────
# TASK MANAGEMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/tasks", status_code=201, tags=["Tasks"])
async def create_task(
    project_id: str,
    body: TaskCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Add a new task to a project."""
    from app.agents.project_agent import _in_memory_tasks, _recalculate_progress

    task_data = body.model_dump()
    task_data["project_id"] = project_id
    task_data["created_at"] = datetime.now(timezone.utc)
    task_data["updated_at"] = datetime.now(timezone.utc)

    inserted_id = None
    try:
        db = get_database()
        result = await db.tasks.insert_one(task_data)
        inserted_id = str(result.inserted_id)
        task_data["_id"] = inserted_id
        task_data["id"] = inserted_id
        await _recalculate_progress(project_id)
    except Exception as e:
        logger.warning(f"MongoDB task insert failed ({e}); using in-memory fallback.")
        task_id = f"task_{uuid4().hex[:8]}"
        task_data["_id"] = task_id
        task_data["id"] = task_id
        if project_id not in _in_memory_tasks:
            _in_memory_tasks[project_id] = []
        _in_memory_tasks[project_id].append(task_data)
        await _recalculate_progress(project_id)

    return {"success": True, "task": _serialize(task_data)}


@router.put("/tasks/{task_id}", tags=["Tasks"])
async def update_task(
    task_id: str,
    body: TaskUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update an existing task."""
    from app.agents.project_agent import _in_memory_tasks, _recalculate_progress

    update_fields = {k: v for k, v in body.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc)

    updated = False
    project_id = None

    try:
        db = get_database()
        if ObjectId.is_valid(task_id):
            existing_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
            if existing_task:
                project_id = existing_task.get("project_id")
                await db.tasks.update_one(
                    {"_id": ObjectId(task_id)},
                    {"$set": update_fields},
                )
                updated = True
                if project_id:
                    await _recalculate_progress(project_id)
    except Exception:
        pass

    if not updated:
        for pid, t_list in _in_memory_tasks.items():
            for t in t_list:
                if t.get("id") == task_id or str(t.get("_id")) == task_id:
                    t.update(update_fields)
                    updated = True
                    project_id = pid
                    break
            if updated:
                break

    if not updated:
        raise HTTPException(status_code=404, detail="Task not found.")

    return {"success": True, "task_id": task_id}


@router.delete("/tasks/{task_id}", tags=["Tasks"])
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a task by ID."""
    from app.agents.project_agent import _in_memory_tasks, _recalculate_progress

    deleted = False
    project_id = None

    try:
        db = get_database()
        if ObjectId.is_valid(task_id):
            existing_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
            if existing_task:
                project_id = existing_task.get("project_id")
                res = await db.tasks.delete_one({"_id": ObjectId(task_id)})
                if res.deleted_count > 0:
                    deleted = True
                    if project_id:
                        await _recalculate_progress(project_id)
    except Exception:
        pass

    if not deleted:
        for pid, t_list in list(_in_memory_tasks.items()):
            new_list = [t for t in t_list if t.get("id") != task_id and str(t.get("_id")) != task_id]
            if len(new_list) < len(t_list):
                _in_memory_tasks[pid] = new_list
                deleted = True
                await _recalculate_progress(pid)
                break

    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found.")

    return {"success": True, "message": f"Task {task_id} deleted."}


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT UPLOAD ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/documents", tags=["Documents"])
async def upload_document(
    project_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form("requirements"),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a document (requirements, architecture) for a project.
    The document is parsed, saved to MongoDB, and ingested into ChromaDB by the RAG Agent.
    """
    from app.agents import rag_agent

    db = get_database()

    # Parse the uploaded file
    file_bytes = await file.read()
    try:
        text = parse_document(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save document metadata to MongoDB
    doc_record = {
        "project_id": project_id,
        "filename": file.filename,
        "doc_type": doc_type,
        "size_bytes": len(file_bytes),
        "uploaded_by": str(current_user["_id"]),
        "uploaded_at": datetime.now(timezone.utc),
    }
    result = await db.documents.insert_one(doc_record)
    doc_id = str(result.inserted_id)

    # Ingest into RAG
    chunk_count = await rag_agent.ingest_document(
        document_text=text,
        document_id=doc_id,
        project_id=project_id,
        doc_type=doc_type,
        metadata={"filename": file.filename},
    )

    return {
        "success": True,
        "document_id": doc_id,
        "filename": file.filename,
        "chunks_ingested": chunk_count,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GITHUB ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/github/connect", tags=["GitHub"])
async def github_connect(
    body: GitHubConnectRequest,
    current_user: dict = Depends(get_current_user),
):
    """Validate a GitHub PAT and save repository connection to the project."""
    db = get_database()

    # Validate PAT by attempting to fetch user info
    try:
        from github import Github, GithubException
        gh = Github(body.pat)
        gh_user = await __import__("asyncio").to_thread(lambda: gh.get_user().login)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid GitHub PAT: {str(e)}")

    # Save to project
    await db.projects.update_one(
        {"_id": ObjectId(body.project_id)},
        {"$set": {
            "github_repo_url": body.repo_url,
            "github_pat": body.pat,
            "github_connected": True,
            "github_user": gh_user,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    return {"success": True, "github_user": gh_user, "repo_url": body.repo_url}


@router.post("/github/sync", tags=["GitHub"])
async def github_sync(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Manually trigger a GitHub sync for a project.
    Orchestrator → GitHubAgent → ProjectAgent.
    """
    settings = get_settings()
    db = get_database()
    project = None
    try:
        if ObjectId.is_valid(project_id):
            project = await db.projects.find_one({"_id": ObjectId(project_id)})
    except Exception:
        pass

    if not project:
        from app.agents.project_agent import _in_memory_projects
        project = _in_memory_projects.get(project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    repo_url = project.get("github_repo_url")
    pat = project.get("github_pat") or settings.GITHUB_PAT

    if not repo_url or not pat:
        raise HTTPException(
            status_code=400,
            detail="GitHub repository URL or Personal Access Token is missing.",
        )

    try:
        result = await orchestrator.run("sync_github", {
            "project_id": project_id,
            "repo_url": repo_url,
            "pat": pat,
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database or sync failure: {str(e)}")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# MEETING UPLOAD ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/meetings/upload", tags=["Meetings"])
async def upload_meeting(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a meeting transcript.
    Orchestrator → MeetingAgent → ProjectAgent → RAGAgent.
    Supported formats: .txt, .docx, .pdf
    """
    file_bytes = await file.read()
    try:
        transcript_text = parse_document(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = await orchestrator.run("upload_meeting", {
        "project_id": project_id,
        "transcript_text": transcript_text,
        "filename": file.filename,
    })

    return result


# ─────────────────────────────────────────────────────────────────────────────
# AI CHAT ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/chat", tags=["Chat"])
async def chat(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Answer a natural language question using RAG over the project knowledge base.
    Orchestrator → RAGAgent.
    """
    result = await orchestrator.run("chat", {
        "question": body.question,
        "project_id": body.project_id or "",
    })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/summary/{project_id}", tags=["Summary"])
async def get_summary(
    project_id: str,
    summary_type: str = "daily",
    current_user: dict = Depends(get_current_user),
):
    """
    Generate and return an AI-powered project summary.
    Orchestrator → SummaryAgent.
    Valid summary_type values: daily, weekly, sprint, executive, health.
    """
    result = await orchestrator.run("get_summary", {
        "project_id": project_id,
        "summary_type": summary_type,
    })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/health", tags=["System"])
async def health_check():
    """Return service health status including MongoDB ping check. No auth required."""
    settings = get_settings()
    mongo_status = "disconnected"
    try:
        db = get_database()
        await db.command("ping")
        mongo_status = "connected"
    except Exception as e:
        mongo_status = f"disconnected ({str(e)})"

    return {
        "status": "healthy" if mongo_status == "connected" else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "mongodb": mongo_status,
        "llm_provider": settings.LLM_PROVIDER,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
