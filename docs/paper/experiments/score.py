"""Score whatever clips are done: CER/WER per candidate, paired wins vs auto, sign test."""
import json, sys, math, importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("rf", Path(__file__).with_name("run_fleurs.py"))
src = Path(__file__).with_name("run_fleurs.py").read_text()
to_odia_src = src[src.index("BLOCKS ="):src.index("rows = list")]
from app.proxy_eval import Tally
ns = {}; exec(to_odia_src, ns); to_odia = ns["to_odia"]
done = json.loads(Path(sys.argv[1]).read_text())
CANDS = ["bn", "as", "hi", "auto"]
per = {l: [] for l in CANDS}; tal = {l: Tally() for l in CANDS}
for rec in done.values():
    for l in CANDS:
        h = to_odia(rec["hyp"][l]); tal[l].add(h, rec["ref"]); t = Tally(); t.add(h, rec["ref"]); per[l].append(t.cer)
def sign_p(b, w):
    n = b + w; k = min(b, w)
    return min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n) if n else 1.0
out = {"passages": len(done), "sentences": len({r["sentence"] for r in done.values()}),
       "minutes": round(sum(r["ms"] for r in done.values()) / 60000, 2), "candidates": []}
for l in CANDS:
    row = {"language": l, "cer": tal[l].cer, "wer": tal[l].wer}
    if l != "auto":
        b = sum(x < y for x, y in zip(per[l], per["auto"])); w = sum(x > y for x, y in zip(per[l], per["auto"]))
        row.update(better=b, worse=w, same=len(per[l]) - b - w, p=round(sign_p(b, w), 6))
    out["candidates"].append(row)
print(json.dumps(out, indent=1))
