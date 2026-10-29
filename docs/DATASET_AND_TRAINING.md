# Vani: dataset and training plan

Vani is SwaraVeda's speech AI. Today it uses general pretrained models; this
document describes where its training data comes from and how it will be
trained to understand endangered dialects that have little or no data online.

## What Vani uses today

| Step | Technique | Model / tool |
|---|---|---|
| Clean audio | Resample to 16 kHz mono, high-pass filter, loudness normalisation | ffmpeg |
| Speech to text | Automatic speech recognition, with a per-dialect language hint (e.g. Tulu → Kannada) | Whisper large-v3 (via Groq) |
| Translation | Machine translation to English | Llama 3.3 70B (via Groq) |
| Search by meaning | Sentence embeddings + vector similarity | Multilingual MiniLM (384-d) + pgvector |
| Search by words | Full-text search with ranking | PostgreSQL |

None of these models has been trained on the dialects themselves yet.

## The dataset: SwaraVeda's own archive

Most of these dialects are not on the internet, so the archive creates the data:

1. **Collect**: community members record speakers. Each speaker separately agrees to public listening and to "may help train speech AI".
2. **Draft**: Vani transcribes using the closest related language it knows.
3. **Correct**: native speakers fix each passage while listening.
4. **Verify**: a verifier approves each passage.
5. **Export**: Manage → Training dataset downloads every verified, AI-consented passage (audio link, timestamps, the AI's first draft and the corrected text) as JSONL or CSV.

Reference recordings can also be added from Wikimedia Commons (Manage → Find on
Wikimedia Commons). Only openly licensed clips (public domain, CC0, CC BY,
CC BY-SA) are added, and only those count toward training data.

## Open resources to bootstrap from

Check each resource's licence and terms before use.

| Resource | What it has | Use |
|---|---|---|
| Vaani (IISc Bangalore & ARTPARK, with Google) | District-wise speech across India | Closest to dialect-level speech |
| IndicVoices, Kathbath, Shrutilipi (AI4Bharat, IIT Madras) | Transcribed speech in 12–22 Indian languages | Base training for related languages |
| Mozilla Common Voice | Crowd-read speech incl. Santali, Odia, Assamese | Open data; Santali is one of our dialects |
| Google FLEURS, OpenSLR Indian sets | Read speech in many Indian languages | Benchmarks |
| Meta MMS | Speech models for 1,100+ languages | Starting model where Whisper has no support |
| Bhashini (Govt. of India), LDC-IL (CIIL Mysore) | Indian speech and text corpora, some tribal languages | Additional data (some on request) |
| ELAR (SOAS), PARADISEC | Linguists' field recordings of endangered languages | Real dialect audio (access by permission) |
| Wikipedia in Tulu, Santali, Konkani, Maithili, Bhojpuri, Manipuri… | Written text | Spelling and translation side |
| Lingua Libre (via Wikimedia Commons) | Words spoken by native speakers | Pronunciation references |

## Training plan

1. **Base model**: start from a multilingual model (Whisper, MMS or IndicWhisper).
2. **Related language**: adapt on a related major language first (e.g. Kannada before Tulu).
3. **Fine-tune**: train on SwaraVeda's verified passages per dialect, using lightweight adapters (e.g. LoRA) so a few hours of data can already help.
4. **Evaluate**: measure word error rate (WER) on held-out verified passages, before and after.
5. **Loop**: better drafts mean faster correction, which means more verified data for the next round.
