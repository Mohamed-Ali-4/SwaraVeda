"""Proxy-language comparison on FLEURS Odia (a language Whisper does not support),
using SwaraVeda's own clip cleaning, Whisper call and CER/WER scoring."""
import csv, json, random, sys, time
from pathlib import Path
from app import nlp, proxy_eval
from app.proxy_eval import Tally, cut_clip, transcribe_clip

root, n, out = Path(sys.argv[1]), int(sys.argv[2]), Path(sys.argv[3])
CANDS = ["bn", "hi", "as", "auto"]
# Brahmic Unicode blocks are laid out in parallel; map a draft written in another
# Indic script onto Odia (U+0B00) so it can be compared with the Odia reference.
BLOCKS = [(b, b + 0x7F) for b in range(0x0900, 0x0D80, 0x80) if b != 0x0B00]  # Devanagari ... Malayalam
def to_odia(text):
    o = []
    for c in text:
        cp = ord(c)
        for lo, hi in BLOCKS:
            if lo <= cp <= hi and cp not in (0x0964, 0x0965):
                c = chr(0x0B00 + cp - lo); break
        o.append(c)
    return "".join(o)

rows = list(csv.reader(open(root / "dev.tsv", encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE))
wav = {p.name: p for p in (root / "audio").rglob("*.wav")}
rows = [r for r in rows if r[1] in wav]
random.Random("swaraveda").shuffle(rows)
rows = rows[:n]
last = 0.0
done = json.loads(out.read_text()) if out.exists() else {}
for k, r in enumerate(rows):
    if r[1] in done: continue
    clip = cut_clip(wav[r[1]], 0, int(int(r[5]) / 16), out.parent / "clip.ogg")
    rec = {"ref": r[2], "sentence": r[0], "gender": r[6], "ms": int(int(r[5]) / 16), "hyp": {}}
    for lang in CANDS:
        time.sleep(max(0, last + 3.2 - time.time()))  # stay under Groq's 20 requests per minute
        last = time.time()
        rec["hyp"][lang] = transcribe_clip(clip, None if lang == "auto" else lang)
    done[r[1]] = rec
    out.write_text(json.dumps(done, ensure_ascii=False, indent=1))
    print(k, flush=True)

tallies = {l: Tally() for l in CANDS}
per = {l: [] for l in CANDS}
for rec in done.values():
    for l in CANDS:
        tallies[l].add(to_odia(rec["hyp"][l]), rec["ref"])
        one = Tally(); one.add(to_odia(rec["hyp"][l]), rec["ref"]); per[l].append(one.cer)
summary = {"passages": len(done), "sentences": len({r["sentence"] for r in done.values()}),
           "minutes": round(sum(r["ms"] for r in done.values()) / 60000, 2), "candidates": []}
for l in CANDS:
    row = {"language": l, "cer": tallies[l].cer, "wer": tallies[l].wer}
    if l != "auto":
        pairs = list(zip(per[l], per["auto"]))
        row["vs_auto"] = {"better": sum(a < b for a, b in pairs), "worse": sum(a > b for a, b in pairs), "same": sum(a == b for a, b in pairs)}
    summary["candidates"].append(row)
print(json.dumps(summary, indent=1))
(out.parent / "summary.json").write_text(json.dumps(summary, indent=1))
