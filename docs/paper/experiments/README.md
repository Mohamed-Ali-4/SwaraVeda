# Experiments behind the NCDTE 2026 paper

## Benchmark: proxy selection on Odia (Table 3)
Odia is an Indian language Whisper does not support (Groq rejects `language=or`).
FLEURS (Conneau et al., SLT 2023; CC BY 4.0) supplies verified transcripts.

1. Download `data/or_in/dev.tsv` and `data/or_in/audio/dev.tar.gz` from the
   `google/fleurs` dataset on Hugging Face and unpack the audio into `<dir>/audio`.
2. From `backend/`, with a Groq key in `GROQ_API_KEY`:
   `PYTHONPATH=. DATABASE_URL=postgresql://u:p@localhost/x JWT_SECRET=x python ../docs/paper/experiments/run_fleurs.py <dir> 100 out.json`
   (100 utterances, seed "swaraveda", candidates bn / hi / as / auto, the archive's
   own clip cleaning, Whisper call and CER/WER code; resumable).
3. `python score.py out.json` prints CER/WER, wins vs auto and the sign test.

`fleurs_odia_drafts.json` holds every Whisper draft used in the paper;
`fleurs_odia_scores.json` is the scored result.

## Pilot data in the live archive (Table 1)
`archive_pilot_snapshot.json` is the public recordings and segments of
swaraveda-api.onrender.com on 25 Nov 2026 (11 recordings, 12 passages).
