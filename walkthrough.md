# AI Project Intelligence Platform — Walkthrough & Documentation

## Overview

The **AI Project Intelligence Platform** is a full-stack multi-agent system designed to automate project tracking, monitor development progress on GitHub, extract insights from meeting transcripts, and generate AI-powered summaries to reduce daily standup meetings.

---

## What Was Built

### 1. Backend Architecture (FastAPI + Microsoft Agent Framework / AutoGen)

The backend is located in [`backend/`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend) and features a **6-Agent Architecture**:

```text
                     React Frontend
                            │
                            ▼
                     FastAPI Backend
                            │
                            ▼
                Orchestrator Agent (MAF)
                            │
        ┌────────────┬────────────┬────────────┬────────────┐
        │            │            │            │
        ▼            ▼            ▼            ▼
 Project Agent  Meeting Agent GitHub Agent RAG Agent
        │            │            │
        └────────────┴────────────┘
                     │
                     ▼
               Summary Agent
                     │
                     ▼
             MongoDB + ChromaDB
```

#### Specialist Agents ([`backend/app/agents/`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/agents/)):
- **[`orchestrator_agent.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/agents/orchestrator_agent.py)**: Central coordinator executing 5 core workflows (`create_project`, `sync_github`, `upload_meeting`, `chat`, `get_summary`). Pure router containing zero business logic.
- **[`project_agent.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/agents/project_agent.py)**: **Single Source of Truth** and the only agent authorized to read/write to MongoDB. Uses LLMs to generate project modules, task lists, and track progress/health metrics.
- **[`meeting_agent.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/agents/meeting_agent.py)**: LLM-powered transcript parser extracting completed tasks, new tasks, blockers, risks, decisions, and deadlines as structured JSON.
- **[`github_agent.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/agents/github_agent.py)**: Integrates via GitHub PAT using PyGithub. Fetches recent commits and pull requests, fuzzy-matching PRs to project tasks.
- **[`rag_agent.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/agents/rag_agent.py)**: Manages ChromaDB vector stores across 3 collections (`requirements`, `meeting_transcripts`, `architecture_docs`) with OpenAI embeddings for natural language RAG Q&A.
- **[`summary_agent.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/agents/summary_agent.py)**: Read-only agent generating 5 report types: Daily, Weekly, Sprint, Executive, and Health.

#### Backend Core Services & API:
- **[`document_parser.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/services/document_parser.py)**: Parses plaintext from `.txt`, `.docx` (python-docx), and `.pdf` (PyMuPDF).
- **[`database.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/config/database.py)**: Async MongoDB connection via Motor across 6 collections (`users`, `projects`, `tasks`, `meetings`, `documents`, `summaries`).
- **[`settings.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/config/settings.py)**: Pydantic configuration supporting both OpenAI and Azure OpenAI.
- **[`api.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/app/api.py)**: Single endpoint file housing all 14 REST API endpoints with JWT authentication and file upload handling.
- **[`main.py`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/main.py)**: FastAPI entry point with CORS middleware and database startup/shutdown lifecycles.

---

### 2. Frontend Application (React + Vite + Tailwind CSS)

The frontend is located in [`frontend/`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend) built with Vite, Tailwind CSS v3, and Framer Motion.

#### 9 Full React Pages ([`frontend/src/pages/`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/)):
1. **[`Login.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/Login.jsx)** (`/login`): Glassmorphism authentication page supporting Registration & Login with JWT persistence.
2. **[`Dashboard.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/Dashboard.jsx)** (`/`): High-level dashboard showing total projects, completion rate, health breakdown, and active project cards.
3. **[`Projects.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/Projects.jsx)** (`/projects`): Searchable gallery of all projects with progress and status badges.
4. **[`CreateProject.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/CreateProject.jsx)** (`/projects/new`): 4-step wizard for project creation, requirement file upload, team setup, and AI task breakdown generation.
5. **[`ProjectDetails.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/ProjectDetails.jsx)** (`/projects/:id`): Deep dive into project tasks, module breakdown, active blockers, meeting transcripts, and progress metrics.
6. **[`MeetingUpload.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/MeetingUpload.jsx)** (`/projects/:id/meetings`): File dropzone for TXT/DOCX/PDF meeting transcripts with instant AI insight extraction previews.
7. **[`GitHubIntegration.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/GitHubIntegration.jsx)** (`/projects/:id/github`): GitHub PAT connection form, manual repository sync button, and commit/PR history viewer.
8. **[`AIChat.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/AIChat.jsx)** (`/chat`): Interactive AI assistant with project selector chips and RAG-powered Q&A.
9. **[`Summary.jsx`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/frontend/src/pages/Summary.jsx)** (`/projects/:id/summary`): Report generation dashboard for Daily, Weekly, Sprint, Executive, and Health summaries.

---

## Verification Summary

| Check | Result | Detail |
|-------|--------|--------|
| Python Environment | ✅ Verified | All required dependencies installed in `.venv` |
| Backend Code Imports | ✅ Verified | `from app.agents.orchestrator_agent import orchestrator` loads clean |
| React Frontend Build | ✅ Verified | Production build compiled cleanly with Vite (`dist/assets/index-nkA-dW_j.js`) |
| Documentation | ✅ Saved | `README.md` & `walkthrough.md` present in workspace root |

---

## Quickstart Instructions

### 1. Backend Setup
1. Edit [`backend/.env`](file:///c:/Users/Bhuvan%20Shanbhag/OneDrive%20-%20Saxon%20Infosystems%20Private%20Limited/Desktop/Project%20Management/backend/.env) with your OpenAI key & MongoDB connection string.
2. Activate virtual environment and launch server:
   ```powershell
   .venv\Scripts\Activate.ps1
   cd backend
   python main.py
   ```
   API Docs available at: `http://localhost:8000/docs`

### 2. Frontend Setup
1. In a second terminal:
   ```powershell
   cd frontend
   npm run dev
   ```
   Access Web App at: `http://localhost:5173`
