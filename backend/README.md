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
clickable and testable from that page. Share this URL with the team.

## Database

Run `schema.sql` once in Supabase → SQL Editor. Create a storage bucket
named `recordings` (Storage → New bucket, public).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` `/auth/login` | JWT auth |
| GET | `/auth/me` | Current user |
| GET POST | `/dialects` | Dialect catalogue |
| POST | `/recordings/upload-url` | Presigned upload — browser uploads direct to storage |
| POST GET | `/recordings` | Create / list with filters + pagination |
| GET PATCH | `/recordings/{id}` | Detail (with segments) / update |
| POST | `/recordings/{id}/transcribe` | Enqueue ASR job, returns immediately |
| PATCH | `/segments/{id}` | **The correction endpoint** |
| POST | `/segments/{id}/verify` | Verifier sign-off |
| GET | `/search?q=` | Full-text search over transcripts |
| GET | `/stats` | Dashboard counts |

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
