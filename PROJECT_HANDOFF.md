# Project Handoff & Context

> **Purpose of this file:** a single, self-contained briefing you can paste (or point Claude at) in a new session so it instantly understands what this project is, how it's laid out, how to run it, the frontend design system in use, and what was changed most recently. Last updated: **2026-07-30**.

---

## 1. What this project is

**AI Project Intelligence Platform** — an AI-powered app that helps software teams **reduce daily standup meetings** by automatically monitoring GitHub activity, processing meeting transcripts, maintaining project state, and generating AI summaries.

- **Frontend:** React 18 + Vite + Tailwind CSS 3 + Framer Motion (SPA, runs at `http://localhost:5173`)
- **Backend:** FastAPI (Python 3.12+) with a Microsoft AutoGen multi-agent system (runs at `http://localhost:8000`, docs at `/docs`)
- **LLM:** OpenAI GPT-4o **or** Azure OpenAI (switch via `LLM_PROVIDER`)
- **Database:** MongoDB (async via Motor)
- **Vector DB:** ChromaDB (persistent, for RAG)
- **Auth:** JWT (python-jose) + bcrypt password hashing

The full product README lives at [README.md](README.md). Design/build history: [implementation_plan.md](implementation_plan.md), [walkthrough.md](walkthrough.md).

---

## 2. Folder structure (what's where)

```
Project Management/
├── README.md                     # Product overview, setup, API list, features
├── PROJECT_HANDOFF.md            # ← this file
├── implementation_plan.md/.txt   # Original build plan (reference)
├── walkthrough.md                # Feature walkthrough (reference)
├── .venv/                        # Python virtual environment (not committed)
│
├── backend/
│   ├── .env                      # Secrets & config — FILL THIS IN (see §4)
│   ├── requirements.txt          # Python deps (audited 2026-07-30, see §6)
│   ├── main.py                   # FastAPI app factory + lifespan startup
│   ├── chroma_store/             # ChromaDB persisted vectors (auto-generated)
│   └── app/
│       ├── api.py                # ALL FastAPI endpoints + Pydantic models + auth
│       ├── agents/
│       │   ├── orchestrator_agent.py  # Central router (no business logic)
│       │   ├── project_agent.py       # ONLY agent that writes to MongoDB; AI task gen
│       │   ├── meeting_agent.py       # Transcript → structured insights (JSON)
│       │   ├── github_agent.py        # Reads commits/PRs, matches to tasks (never writes DB)
│       │   ├── rag_agent.py           # ChromaDB embeddings + RAG Q&A
│       │   └── summary_agent.py       # 5 report types (daily/weekly/sprint/executive/health)
│       ├── config/
│       │   ├── settings.py            # Pydantic BaseSettings (reads .env)
│       │   └── database.py            # Motor Mongo client + lifespan connect/close
│       └── services/
│           └── document_parser.py     # TXT/DOCX/PDF text extraction (docx, PyMuPDF)
│
└── frontend/
    ├── package.json              # Scripts: dev / build / preview
    ├── tailwind.config.js        # Tailwind theme (note: has unused legacy dark colors)
    ├── tsconfig.json             # noUnusedLocals/Params ON (applies to .ts only)
    ├── index.html
    └── src/
        ├── main.jsx              # React entry (renders <App/>, imports index.css)
        ├── App.jsx               # Router + ProtectedRoute + AppLayout (sidebar + main)
        ├── index.css             # ★ DESIGN SYSTEM — all shared classes live here (see §5)
        ├── services/api.js       # Axios instance, JWT interceptors, all API calls
        ├── components/
        │   ├── Sidebar.jsx       # Fixed dark nav (slate-900, indigo active rail)
        │   ├── MetricCard.jsx    # KPI tile: white card + colored icon chip
        │   ├── ProgressBar.jsx   # Single-tone gradient-free progress bar
        │   └── HealthBadge.jsx   # good / needs_attention / at_risk pill
        └── pages/
            ├── Login.jsx             # Login/Register (public route)
            ├── Dashboard.jsx         # "/" — welcome banner + KPIs + active projects
            ├── Projects.jsx          # "/projects" — grid + search + edit/delete modal
            ├── CreateProject.jsx     # "/projects/new" — 4-step wizard
            ├── ProjectDetails.jsx    # "/projects/:id" — tabs: tasks/meetings/modules + modals
            ├── MeetingUpload.jsx     # "/projects/:id/meetings" — transcript dropzone
            ├── GitHubIntegration.jsx # "/projects/:id/github" — connect + sync
            ├── Summary.jsx           # "/projects/:id/summary" — AI report generator
            └── AIChat.jsx            # "/chat" — RAG chat (has a dark "monochrome hero" header)
```

**Leftover Vite-template files (unused, safe to ignore/delete):** `frontend/src/counter.ts`, `main.ts`, `style.css`, `assets/typescript.svg`, `assets/vite.svg`, `assets/hero.png`.

---

## 3. How to run it

**Backend** (from the `Project Management` directory):
```powershell
.venv\Scripts\Activate.ps1
cd backend
python main.py          # → http://localhost:8000  (Swagger at /docs)
```

**Frontend:**
```powershell
cd frontend
npm install             # first time only
npm run dev             # → http://localhost:5173
npm run build           # production build (runs `tsc && vite build`)
```

Prerequisites: Python 3.12+, Node 18+, a reachable MongoDB (local or Atlas), and an OpenAI/Azure key.

---

## 4. Configuration (`backend/.env`)

Read by `app/config/settings.py`. Key variables:

```env
LLM_PROVIDER=openai            # "openai" or "azure"
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
# Azure alternative:
AOAI_CHAT_KEY=...
AOAI_CHAT_ENDPOINT=...
AOAI_CHAT_DEPLOYMENT=...
AOAI_API_VERSION_GPT=2024-08-01-preview

MONGODB_URI=mongodb://localhost:27017   # or a mongodb+srv:// Atlas URI
MONGODB_DB_NAME=project_intelligence
CHROMADB_PATH=./chroma_store
GITHUB_PAT=                    # optional global PAT (per-project PAT also supported)
JWT_SECRET=change-this-secret  # set a strong random value
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```
Frontend API base URL override: set `VITE_API_URL` (defaults to `http://localhost:8000`).

---

## 5. Frontend design system (IMPORTANT for UI work)

The chosen direction is **"Refined indigo accent" — clean enterprise SaaS** (think Linear/Stripe). **Indigo is the only brand accent; other colors are reserved for status only** (emerald = good/success, amber = warning, rose = danger/at-risk). All shared styling lives in [frontend/src/index.css](frontend/src/index.css) as Tailwind `@layer components` classes.

**Shared canvas:** a single `#f8fafc` (slate-50) background is set on `<body>` (fixed) so every page shares the exact same backdrop.

### Class vocabulary (use these — they exist)
| Class | What it is |
|-------|-----------|
| `.glass-card` | Base container: solid white, hairline border, soft shadow |
| `.card-interactive` | Add to a `.glass-card` for hover **lift + indigo-tinted border/shadow** and press-down on click. Use on clickable containers (project cards, module cards, KPI tiles, summary buttons). |
| `.btn-primary` / `.btn-secondary` / `.btn-success` / `.btn-danger` | Buttons (indigo / white / emerald / rose) |
| `.input-field` (alias `.form-input`) | Text inputs. **`<select>` gets a custom indigo chevron + hover border + indigo-highlighted `option:checked` automatically** via CSS — don't add a manual chevron icon. |
| `.form-label` | Uppercase field label |
| `.badge-good` / `-warning` / `-danger` / `-info` | Status pills |
| `.page-header` / `.page-title` / `.page-subtitle` / `.section-heading` | Page headings (standard page header pattern) |
| `.skeleton` | Shimmer loading placeholder |

### Component conventions
- **MetricCard** — white `.glass-card` with a small tinted **icon chip**; `color` prop picks the chip hue (`primary`/`emerald`/`amber`/`rose`/`sky`/`purple`/`slate`). Value/label stay slate.
- **ProgressBar** — single-tone bar; `color` prop (`primary`/`emerald`/`amber`/`rose`/`sky`), default indigo.
- **Sidebar** — fixed dark `slate-900`, 64-wide (`ml-64` on main), active item = `slate-800` bg + indigo left rail + indigo icon.

### ⚠️ Removed classes — DO NOT reintroduce
An earlier "colorful/gradient" pass was **reverted** for looking unprofessional. These classes were **deleted from index.css** and must not be used (they render as nothing and silently break layout):
`hero-*` (hero-indigo/violet/sky/amber/…, hero-title, hero-subtitle, hero-eyebrow, hero-glow), `card-indigo|emerald|purple|sky|amber|rose|teal|fuchsia`, `chip-*`, `icon-chip`, `btn-on-hero`, `btn-on-hero-ghost`, `panel-title`.
If you need a colored container, use `.glass-card` plus a semantic border/bg (e.g. `border-rose-200 bg-rose-50`) — that's the established pattern for the blocker boxes.

### Known style exception
- **AIChat.jsx** has its own dark `slate-900` "monochrome hero" header (not the standard `page-header`). It renders fine and looks intentional; left as-is. Convert to `page-header` if full consistency is wanted.
- `tailwind.config.js` still contains legacy dark-theme tokens (`surface.*`, `glass`, `hero-gradient`, glow shadows) from the original template — **currently unused**; harmless but could be trimmed.

---

## 6. Backend dependencies (`requirements.txt`)

Audited 2026-07-30 against actual imports — **all used packages are covered.** Notes:
- **Added `certifi`** (was missing) — imported directly in `config/database.py` for MongoDB Atlas (`mongodb+srv`) TLS via `certifi.where()`.
- `email-validator` (needed by `EmailStr`), `python-multipart` (File/Form uploads), `python-dotenv` (`env_file=".env"`) — all correctly present.
- **`fastmcp` is listed but imported nowhere** — dead/optional dependency (pulls a large tree). Safe to remove unless MCP tools are planned.
- `pydantic` is used directly but only pinned transitively (via fastapi/pydantic-settings) — optional to pin explicitly.

---

## 7. Key conventions & gotchas

- **Agent boundaries matter:** `project_agent.py` is the *only* agent that writes to MongoDB. `github_agent` and `meeting_agent` return data/JSON; the orchestrator routes and does no business logic. Preserve this when extending.
- **IDs:** documents use both `id` and `_id` in places; frontend guards with `project.id || project._id`.
- **Auth flow:** JWT stored in `localStorage` (`token` + `user`); axios request interceptor attaches `Bearer`; a 401 response clears storage and redirects to `/login`. Protected routes gate on presence of `token`.
- **Build/lint:** `tsconfig.json` has `noUnusedLocals`/`noUnusedParameters` **on**, but `allowJs` is off, so `tsc` only type-checks `.ts` files — `.jsx` pages aren't type-checked by the build. Still, keep imports clean (editor flags unused ones).
- **API contract:** the full endpoint list is in [README.md](README.md#api-endpoints) and mirrored in [frontend/src/services/api.js](frontend/src/services/api.js).

---

## 8. What was done in the most recent session (2026-07-30)

1. **Full UI redesign to the "Refined indigo accent" professional theme.** Rewrote [index.css](frontend/src/index.css) into the clean design system in §5; rebuilt `MetricCard`, `ProgressBar`, `Sidebar`; and converted every page (Dashboard, Projects, ProjectDetails, CreateProject, Summary, MeetingUpload, GitHubIntegration) off the earlier gradient/"hero" look.
2. **Fixed broken pages.** Summary, MeetingUpload, and GitHubIntegration still referenced deleted `hero-*`/`card-*`/`chip-*` classes (headers had collapsed to unstyled text) — all converted to the standard `page-header` + white-card pattern.
3. **Added container hover + dropdown styling** (per request): `.card-interactive` now lifts with an indigo-tinted shadow; all `.input-field` selects got a custom indigo chevron, hover border, and indigo-highlighted selected option.
4. **Audited & fixed `requirements.txt`** — added the missing `certifi` (see §6).
5. Production build verified clean (`npm run build` passes).

---

*To resume in a new session: share this file, state what you want to change, and Claude will have the full picture. Keep §5's "removed classes" list in mind before touching styles.*
