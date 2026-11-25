# Response to Reviewers

We thank the reviewers for their comments. All changes are in the revised paper.

**Comment 1: Shorter title.**
The title is now "Choosing Proxy Languages for Speech Recognition of Unwritten Indian Dialects Using Correction Effort".

**Comment 2: Report the actual CER/WER per candidate proxy and show that the chosen proxy gives lower error.**
We added a benchmark (Sections 5.2 and 6.2, Table 3). Odia is an Indian language that Whisper does not support, which puts it in the same position as an unsupported dialect. FLEURS supplies human-verified transcripts that play the role of the community's corrections. We used 100 utterances (81 sentences, 19.1 min). Each passed through the archive's own pre-processing and Whisper large-v3, and we scored four candidates: Bengali, Assamese, Hindi and automatic language identification.

| Proxy | CER (%) | WER (%) | Better / worse than auto |
|---|---|---|---|
| Bengali | 44.5 | 91.6 | 16 / 9 |
| Assamese | 60.7 | 105.1 | 19 / 80 |
| **Hindi (selected)** | **37.7** | 108.8 | 52 / 42 |
| Automatic | 44.6 | 92.9 | - |

The proxy selected by correction effort (Hindi) lowers CER by 6.9 points relative to automatic identification (95% bootstrap CI 4.2 to 9.6 points). Assamese, a close relative of Odia, performs far worse (p < 0.001). This shows that the proxy suggested by language family is not necessarily the best one.

We report the limitations openly:
- The per-utterance gain is not significant (sign test p = 0.35).
- WER ranks the candidates differently, because Hindi drafts split Odia words; we explain why selection uses CER.
- The benchmark is read speech from female speakers.

Field recordings of Tulu, Kodava and Beary are being collected in the archive, and the same comparison runs there automatically.

**Comment 3: Report speakers, recordings and verified passages per dialect.**
Table 1 reports, per dialect, everything the live archive held at submission: 11 recordings (75 s) from 11 speakers in 8 dialects, with 12 passages, of which 5 are corrected and 2 verified. We state plainly that this pilot data is too small to rank proxies, which is why we added the benchmark above. The archive also reports these counts per dialect to its verifiers.

The code and raw outputs of the experiment are in the project repository (docs/paper/experiments).
