# SwaraVeda 🪷

A community archive for endangered dialects and oral traditions. Speakers
record songs, stories and conversations; speech AI drafts a transcript;
the community corrects, translates and verifies it. The corrected
transcripts become a dataset for training speech models on languages that
big AI systems ignore.

**Live:** [swara-veda.vercel.app](https://swara-veda.vercel.app) · API docs: [swaraveda-api.onrender.com/docs](https://swaraveda-api.onrender.com/docs)

## Features

| | |
|---|---|
| **Record or upload** | Record in the browser or upload a file; audio goes straight to storage. Two separate consents per recording: public listening, and AI training. |
| **AI transcription** | Whisper large-v3 drafts a timestamped transcript. Each dialect can name the language to transcribe with (e.g. Tulu → Kannada), since most dialects have no model of their own. Live progress in the UI. |
| **Correction and verification** | Contributors correct each segment; the machine draft is kept beside the correction. Verifiers sign off segments. |
| **AI translation** | One click suggests an English translation and Latin transliteration for the contributor to review. |
| **Search** | Keyword search, and semantic search that finds passages by meaning across languages. |
| **Dataset export** | JSONL/CSV of (machine draft, human correction, audio, timestamps), consented recordings only, ready for fine-tuning. |
| **Dialect catalogue** | Region, script, ISO code, UNESCO endangerment status. |
| **Roles** | Contributor, verifier, admin; admins manage roles in the app. |

## Architecture

```
Browser (React, Vercel)
   │  REST + JWT                         audio upload (signed URL)
   ▼                                              │
FastAPI (Render) ───────────────► Supabase Storage ◄┘
   │  SQLModel                           ▲
   ▼                                     │ audio
Supabase Postgres (pgvector)             │
   ▲                                     │
   └── transcription pipeline ───────────┘
        Groq: Whisper large-v3 (speech → text), Llama (translation)
        Hugging Face Inference: multilingual embeddings (semantic search)
```

The API runs the AI pipeline itself as a background task by calling hosted
models, so it fits on a free server. For offline or private use,
`backend/worker` runs the same pipeline with local models (faster-whisper,
sentence-transformers, optional pyannote speaker diarization) and picks up
queued jobs instead.

## Repository

```
backend/    FastAPI API, ML worker, schema.sql, tests   → see backend/README.md
frontend/   React + Vite + Tailwind
render.yaml Render blueprint for the API
```

## Run locally

Needs Python 3.12+, Node 22+, and a Supabase project (or any Postgres with
pgvector, without file uploads).

```bash
# API
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in Supabase values and JWT_SECRET
uvicorn app.main:app --reload            # http://localhost:8000/docs

# Frontend (second terminal)
cd frontend
npm install
npm run dev                              # http://localhost:5173
```

Database: run `backend/schema.sql` once in Supabase → SQL Editor, and create
a public storage bucket named `recordings`. The API applies later schema
changes itself at startup.

## Deploy

- **API:** Render → New → Blueprint → this repo. Fill in `DATABASE_URL`
  (Supabase *Session pooler* URL), `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (legacy `service_role` key), `CORS_ORIGINS`
  (the frontend URL, no trailing slash) and `ADMIN_EMAILS`.
- **Frontend:** Vercel → import repo, root directory `frontend`, env
  `VITE_API_URL` = the API URL.
- **AI features** (free keys, set on Render):
  - `GROQ_API_KEY` from [console.groq.com/keys](https://console.groq.com/keys): transcription and translation
  - `HF_TOKEN` from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (read): semantic search

  Without them the app still works; transcription jobs wait for the local
  worker and semantic search is disabled.

Check a deployment at `/health/db`: it tests the database connection,
every table, writes, and reports schema drift.

## Tests

```bash
cd backend && pytest                     # SQLite
TEST_POSTGRES_URL=postgresql://... pytest   # also real Postgres + pgvector
cd frontend && npm run lint && npm run build
```

CI runs both on every pull request.

## Data and consent

- Audio and transcripts belong to the communities that contribute them;
  recordings default to CC-BY-NC-4.0.
- `consent_public` and `consent_ai_training` are separate. Exports only
  include recordings with AI-training consent.
- With hosted AI on, audio and transcripts are sent to Groq and Hugging
  Face for processing; check their data policies against what speakers
  agreed to. Use the local worker for recordings that must not leave your
  infrastructure.
