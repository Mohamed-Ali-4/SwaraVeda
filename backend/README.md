# SwaraVeda — Backend API

FastAPI + Supabase (PostgreSQL) backend for the SwaraVeda dialect archive.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # then fill in your Supabase values
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs — interactive API docs. Every endpoint is
clickable and testable from that page.

Tests: `pytest`. Set `TEST_POSTGRES_URL` to also run the real-Postgres
suite (search SQL, pgvector, migrations).

## Database

Run `schema.sql` once in Supabase → SQL Editor. Create a storage bucket
named `recordings` (Storage → New bucket, public).

## Endpoints

Full, clickable reference at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` `/auth/login` | JWT auth (emails in `ADMIN_EMAILS` become admin) |
| GET PATCH | `/auth/me` | Current user / update profile |
| GET POST | `/dialects` | Dialect catalogue |
| PATCH | `/dialects/{id}` | Edit, e.g. set `asr_language` (verifier) |
| POST | `/recordings/upload-url` | Presigned upload — browser uploads direct to storage |
| POST GET | `/recordings` | Create / list with filters + pagination |
| GET PATCH DELETE | `/recordings/{id}` | Detail (with segments and latest job) / update / delete |
| POST | `/recordings/{id}/transcribe` | Start transcription, returns the job |
| PATCH | `/segments/{id}` | **The correction endpoint** |
| POST | `/segments/{id}/translate` | AI translation + transliteration suggestion |
| POST | `/segments/{id}/verify` | Verifier sign-off |
| GET | `/search?q=` `/search/semantic?q=` | Keyword / meaning-based search (public recordings) |
| GET | `/review/segments?state=` | Passages needing correction or verification, with counts |
| GET POST | `/tags`, `/tags/{recording_id}/tags` | Tags |
| GET | `/export/segments?format=jsonl\|csv` | Fine-tuning dataset (verifier) |
| GET PATCH | `/admin/users` | User roles (admin) |
| GET | `/stats` | Dashboard counts |
| GET | `/nlp/status` | Which AI features are configured |
| GET | `/health` `/health/db` | Liveness / database diagnostics |

## AI pipeline

`POST /recordings/{id}/transcribe` creates a job. Then either:

- **Hosted** (`GROQ_API_KEY` set): the API runs `app/pipeline.py` as a
  background task — download audio, pre-process it (`app/audio.py`: ffmpeg
  to 16 kHz mono Opus, 80 Hz high-pass, loudness normalisation; nothing is
  trimmed, so timestamps match the original), Whisper large-v3 via Groq (with the
  dialect's `asr_language` hint), save segments, embed them via Hugging
  Face Inference (`HF_TOKEN`). Nothing is loaded into memory.
- **Local worker**: `python -m worker.main` (install
  `requirements-worker.txt`) polls for queued jobs and runs
  faster-whisper, optional pyannote diarization and sentence-transformers
  locally.

Corrected segments are re-embedded, so semantic search finds the corrected
wording.

## Schema changes

`schema.sql` creates tables for a new database. `app/migrations.py` runs at
startup and adds any missing column, so existing databases (including ones
created from an older schema) are brought up to date automatically. Add new
columns to both.

## Design notes

- `asr_text` and `corrected_text` are separate columns and the machine draft is
  never overwritten. That pair is the fine-tuning dataset.
- Consent is two independent booleans on each recording: public listening and
  AI training are different permissions.
- Audio never passes through this API. Client gets a presigned URL and uploads
  straight to storage.
- Transcription returns a job id rather than blocking, since ASR takes minutes.

## Security

`.env` is gitignored and must stay that way — this repo is public. The
service role key bypasses all database policies; it lives only on the server.
