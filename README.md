# AI Project Intelligence Platform

> An AI-powered platform that helps software development teams **reduce daily standup meetings** by automatically monitoring GitHub activity, processing meeting transcripts, maintaining project state, and generating intelligent AI summaries.

Built with **Microsoft Agent Framework (AutoGen)**, **FastAPI**, **React**, **MongoDB**, and **ChromaDB**.

---

## Architecture

```
              React Frontend (Vite + Tailwind)
                           │
                           ▼
                   FastAPI Backend
                           │
                           ▼
           Orchestrator Agent (AutoGen / MAF)
                           │
   ┌───────────┬───────────┬──────────┬──────────┐
   ▼           ▼           ▼          ▼          ▼
Project    Meeting    GitHub     RAG        Summary
 Agent      Agent     Agent     Agent       Agent
   │           │           │
   └───────────┴───────────┘
                │
                ▼
         MongoDB + ChromaDB
```

### Agent Responsibilities

| Agent | Role |
|-------|------|
| **Orchestrator** | Routes requests, zero business logic |
| **Project Agent** | Single source of truth — only agent that writes to MongoDB |
| **Meeting Agent** | Extracts insights from transcripts, returns structured JSON |
| **GitHub Agent** | Reads commits & PRs, matches to tasks, never writes to DB |
| **RAG Agent** | Manages ChromaDB embeddings, answers questions via RAG |
| **Summary Agent** | Generates 5 types of AI reports from project state |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS 3, Framer Motion |
| Backend | FastAPI, Python 3.12+ |
| AI Framework | Microsoft AutoGen (`autogen-agentchat`) |
| LLM | OpenAI GPT-4o (or Azure OpenAI) |
| Database | MongoDB (Motor async driver) |
| Vector DB | ChromaDB (persistent) |
| GitHub | PyGithub (REST API) |
| Auth | JWT (python-jose + passlib bcrypt) |

---

## Project Structure

```
Project Management/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── orchestrator_agent.py   # Central router
│   │   │   ├── project_agent.py        # DB writes + AI generation
│   │   │   ├── meeting_agent.py        # Transcript extraction
│   │   │   ├── github_agent.py         # GitHub API integration
│   │   │   ├── rag_agent.py            # ChromaDB + RAG Q&A
│   │   │   └── summary_agent.py        # Report generation
│   │   ├── config/
│   │   │   ├── settings.py             # Pydantic BaseSettings
│   │   │   └── database.py             # Motor MongoDB client
│   │   ├── services/
│   │   │   └── document_parser.py      # TXT/DOCX/PDF parsing
│   │   └── api.py                      # All FastAPI endpoints
│   ├── main.py                         # App factory + lifespan
│   ├── .env                            # Configuration (fill in your keys)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/                 # Sidebar, MetricCard, HealthBadge, ProgressBar
│       ├── pages/                      # 9 full pages
│       └── services/api.js             # Axios with JWT interceptors
├── .venv/                              # Python virtual environment
└── README.md
```

---

## Setup Instructions

### Prerequisites
- Python 3.12+
- Node.js 18+
- MongoDB (local or Atlas)
- OpenAI API key (or Azure OpenAI credentials)

### 1. Configure Environment

Open `backend/.env` and fill in your values:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
MONGODB_URI=mongodb://localhost:27017
JWT_SECRET=your-strong-random-secret
```

### 2. Start the Backend

```powershell
# From the Project Management directory:
.venv\Scripts\Activate.ps1

cd backend
python main.py
```

Server runs at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

### 3. Start the Frontend

```powershell
cd frontend
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | Get JWT token |
| POST | `/projects` | Create project (AI generates tasks) |
| GET | `/projects` | List user's projects |
| GET | `/projects/{id}` | Get project with tasks & meetings |
| PUT | `/projects/{id}` | Update project |
| POST | `/projects/{id}/documents` | Upload & ingest document |
| POST | `/github/connect` | Connect GitHub repository |
| POST | `/github/sync` | Manual GitHub sync |
| POST | `/meetings/upload` | Upload & process transcript |
| POST | `/chat` | AI Q&A via RAG |
| GET | `/summary/{id}` | Generate AI summary |
| GET | `/health` | Health check |

---

## Features

- 🤖 **AI Project Setup** — describe a project, AI generates modules & tasks
- 📋 **Meeting Intelligence** — upload transcripts (TXT/DOCX/PDF), extract insights
- 🐙 **GitHub Sync** — fetch commits and PRs, match to project tasks
- 💬 **AI Chat** — ask questions, get RAG-powered answers from all documents
- 📊 **Smart Summaries** — Daily, Weekly, Sprint, Executive, and Health reports
- 🏥 **Project Health** — automatic health scoring (Good / Needs Attention / At Risk)
- 🔒 **JWT Auth** — secure login/registration with bcrypt password hashing

---

## Future Integrations

The architecture is designed for easy extension:
- **Whisper** → replace transcript upload with audio recording transcription
- **GitHub Webhooks** → replace manual sync with real-time push events
- **Microsoft Teams** → receive meeting transcripts automatically
- **SharePoint** → ingest documents from SharePoint libraries
- **Outlook** → process project emails

Add new workflow types to `orchestrator_agent.py` and new agent files — no existing code needs to change.

---

## License

MIT — Built as a portfolio project using Microsoft Agent Framework (AutoGen).
