# AI Project Intelligence Platform — Implementation Plan

## Overview

Build a **portfolio-quality, full-stack AI Project Intelligence Platform** that replaces daily standups. The platform uses **Microsoft Agent Framework (MAF)** — specifically the modern `autogen-agentchat` package — to power a 6-agent architecture coordinated by an Orchestrator.

**Workspace root:** `c:\Users\Bhuvan Shanbhag\OneDrive - Saxon Infosystems Private Limited\Desktop\Project Management`

---

## Key Technical Decisions

> [!IMPORTANT]
> **MAF = `autogen-agentchat` (v0.4+)**
> "Microsoft Agent Framework" refers to the **AutoGen** library suite (`autogen-agentchat` + `autogen-ext[openai]`). AutoGen is Microsoft's official multi-agent framework. Each of the 6 agents will be an `AssistantAgent` with custom tools and system prompts. The Orchestrator will use a `SelectorGroupChat` or direct `run()` calls to route to the appropriate specialist agent per request.

> [!IMPORTANT]
> **Frontend in separate subfolder with Vite + React**
> The frontend uses Vite (not CRA) for speed. Tailwind CSS v3 will be used. The frontend is scaffolded with `npx create-vite@latest frontend -- --template react`.

---

## Open Questions

> [!NOTE]
> No blocking open questions — the spec is detailed enough to proceed. The `.env` template will include placeholder values; you will fill in real keys before running.

---

## Proposed Changes

### Phase 1 — Backend Setup

#### [NEW] `backend/requirements.txt`
All Python dependencies for the backend, including:
- `fastapi`, `uvicorn[standard]`
- `autogen-agentchat`, `autogen-ext[openai]`
- `motor` (async MongoDB driver), `pymongo`
- `chromadb`
- `python-jose[cryptography]` (JWT)
- `passlib[bcrypt]` (password hashing)
- `python-multipart` (file uploads)
- `python-docx`, `PyMuPDF` (document parsing)
- `PyGithub` (GitHub API)
- `python-dotenv`
- `openai`

#### [NEW] `backend/.env`
Template `.env` file with all required config keys (no real secrets).

#### [NEW] `backend/app/config/settings.py`
Pydantic `BaseSettings` class that reads from `.env`. Supports both OpenAI and Azure OpenAI via `LLM_PROVIDER` flag.

#### [NEW] `backend/app/config/database.py`
Async MongoDB connection using `motor`. Creates collections: `users`, `projects`, `tasks`, `meetings`, `documents`, `summaries`.

---

### Phase 2 — Agent Layer (MAF)

Each agent is an `autogen_agentchat.agents.AssistantAgent` with:
- A focused `system_message` defining its role
- A `tools` list of Python functions it can call
- The shared `OpenAIChatCompletionClient` model client

#### [NEW] `backend/app/agents/orchestrator_agent.py`
- Pure routing logic — no business logic
- Inspects the incoming request type (`create_project`, `sync_github`, `upload_meeting`, `chat`, `get_summary`)
- Calls the appropriate downstream agent(s) in sequence
- Returns the consolidated result

#### [NEW] `backend/app/agents/project_agent.py`
- **Single source of truth** and the only agent that writes to MongoDB
- Tools: `create_project`, `update_project_state`, `generate_modules`, `generate_tasks`, `update_health`
- Receives structured data from other agents and persists it

#### [NEW] `backend/app/agents/meeting_agent.py`
- Reads transcript text (TXT, DOCX, PDF already parsed upstream)
- Tools: `extract_meeting_insights`
- Returns structured JSON: `{completed, new_tasks, blockers, risks, decisions, deadlines}`

#### [NEW] `backend/app/agents/github_agent.py`
- Tools: `fetch_commits`, `fetch_pull_requests`, `match_prs_to_tasks`
- Uses `PyGithub` with the stored PAT
- Returns structured PR/commit updates — never writes to DB

#### [NEW] `backend/app/agents/rag_agent.py`
- Tools: `ingest_document`, `query_knowledge`
- Chunks documents → generates embeddings → stores in ChromaDB
- Answers natural language questions using RAG retrieval

#### [NEW] `backend/app/agents/summary_agent.py`
- Tools: `generate_summary`
- Reads project state from MongoDB
- Generates: Daily / Weekly / Sprint / Executive / Health summaries

---

### Phase 3 — FastAPI Backend

#### [NEW] `backend/app/api.py`
Single file with all endpoints:
```
POST /register          → JWT-based user registration
POST /login             → JWT token generation

POST /projects          → Orchestrator → Project Agent (create)
GET  /projects          → List user's projects
GET  /projects/{id}     → Get single project with tasks + metrics
PUT  /projects/{id}     → Orchestrator → Project Agent (update)

POST /projects/{id}/documents  → Upload & ingest docs via RAG Agent

POST /github/connect    → Validate & store GitHub PAT
POST /github/sync       → Orchestrator → GitHub Agent → Project Agent

POST /meetings/upload   → Orchestrator → Meeting Agent → Project Agent → RAG Agent

POST /chat              → Orchestrator → RAG Agent (answer question)

GET  /summary/{id}      → Orchestrator → Summary Agent

GET  /health            → Health check
```

#### [NEW] `backend/app/main.py`
FastAPI app factory with CORS, lifespan events (DB init, ChromaDB init), and router mounting.

---

### Phase 4 — React Frontend

#### [NEW] `frontend/` (Vite + React + Tailwind CSS)

Pages to build:
| Page | Path | Description |
|------|------|-------------|
| Login | `/login` | Auth form with animated background |
| Dashboard | `/` | Overview of all projects, metrics, health |
| Projects | `/projects` | Project list with status cards |
| Create Project | `/projects/new` | Multi-step form with file upload |
| Project Details | `/projects/:id` | Full project view: tasks, PRs, meetings, health |
| Meeting Upload | `/projects/:id/meetings` | Drag-and-drop transcript upload + extraction preview |
| GitHub Integration | `/projects/:id/github` | Sync UI + commit/PR timeline |
| AI Chat | `/chat` | Chat interface with RAG-powered Q&A |
| Summary | `/projects/:id/summary` | Summary type selector + rich generated report |

**Design System:**
- Dark mode first, slate/indigo/emerald palette
- Glassmorphism cards with subtle gradients
- Micro-animations with Framer Motion
- Custom sidebar navigation
- Progress bars, health badges, metric cards

---

### Phase 5 — Configuration & README

#### [NEW] `README.md`
Full setup guide with architecture diagram, environment setup, running instructions.

---

## File Map

```
Project Management/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── orchestrator_agent.py
│   │   │   ├── project_agent.py
│   │   │   ├── meeting_agent.py
│   │   │   ├── github_agent.py
│   │   │   ├── rag_agent.py
│   │   │   └── summary_agent.py
│   │   ├── config/
│   │   │   ├── __init__.py
│   │   │   ├── settings.py
│   │   │   └── database.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── document_parser.py
│   │   ├── __init__.py
│   │   └── api.py
│   ├── main.py
│   ├── .env
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── package.json
├── .venv/            ← already created by user
└── README.md
```

---

## Installation Plan

Packages installed into the existing `.venv`:
```bash
.venv\Scripts\pip install fastapi uvicorn[standard] autogen-agentchat autogen-ext[openai] motor pymongo chromadb python-jose[cryptography] passlib[bcrypt] python-multipart python-docx PyMuPDF PyGithub python-dotenv openai
```

Frontend (Node.js):
```bash
npx create-vite@latest frontend -- --template react
cd frontend && npm install axios react-router-dom framer-motion
npx tailwindcss init -p
```

---

## Verification Plan

### Backend
- `uvicorn main:app --reload` — server starts without errors
- `GET /health` returns `200 OK`
- Agents import cleanly
- MongoDB connection established

### Frontend
- `npm run dev` — Vite dev server starts
- Login page renders with correct styling
- All routes accessible

### Manual Verification
- Create a project with description → verify AI generates modules & tasks
- Upload a `.txt` transcript → verify blockers/tasks extracted
- Sync GitHub → verify commits appear in Project Details
- Ask a chat question → verify RAG answer
- Generate a summary → verify report appears
