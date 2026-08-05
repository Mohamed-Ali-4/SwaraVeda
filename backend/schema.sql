-- SwaraVeda schema. Run this in Supabase -> SQL Editor -> New query.

create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists contributors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null default 'contributor',
  native_dialect text,
  created_at timestamptz default now()
);

create table if not exists dialects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  iso_code text,
  region text,
  script text,
  endangerment_status text,
  description text,
  created_at timestamptz default now()
);

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audio_url text,
  storage_path text,
  duration_seconds numeric,
  dialect_id uuid references dialects(id),
  contributor_id uuid references contributors(id),
  speaker_name text,
  speaker_age_group text,
  genre text,
  recorded_place text,
  recorded_at date,
  consent_public boolean not null default false,
  consent_ai_training boolean not null default false,
  licence text default 'CC-BY-NC-4.0',
  status text not null default 'uploaded',
  notes text,
  created_at timestamptz default now()
);

create table if not exists segments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings(id) on delete cascade,
  seq int not null,
  start_ms int not null,
  end_ms int not null,
  asr_text text,
  corrected_text text,
  transliteration text,
  translation_en text,
  speaker_label text,
  verified_by uuid references contributors(id),
  verified_at timestamptz,
  embedding vector(768),
  unique (recording_id, seq)
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  label text unique not null,
  category text
);

create table if not exists recording_tags (
  recording_id uuid references recordings(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (recording_id, tag_id)
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid references recordings(id) on delete cascade,
  kind text not null default 'transcribe',
  status text not null default 'queued',
  progress int default 0,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists segments_recording_idx on segments (recording_id, seq);
create index if not exists segments_text_idx on segments
  using gin (to_tsvector('simple', coalesce(corrected_text, asr_text, '')));
create index if not exists segments_trgm_idx on segments
  using gin (coalesce(corrected_text, '') gin_trgm_ops);
create index if not exists recordings_dialect_idx on recordings (dialect_id);
create index if not exists recordings_status_idx on recordings (status);

-- Create only after you have a few hundred rows with embeddings:
-- create index segments_embedding_idx on segments using hnsw (embedding vector_cosine_ops);

insert into dialects (name, iso_code, region, script, endangerment_status)
values ('Sample Dialect', 'xxx', 'Karnataka', 'kannada', 'definitely endangered')
on conflict do nothing;
