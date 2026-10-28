import json
from pathlib import Path

from app.schemas import DialectIn

DATA = Path(__file__).resolve().parent.parent / "data" / "dialects.json"


def test_seed_dialects_are_valid():
    rows = json.loads(DATA.read_text())
    assert len(rows) >= 50
    names = [r["name"].lower() for r in rows]
    assert len(names) == len(set(names))
    for row in rows:
        DialectIn(**row)  # raises on an invalid endangerment level
        assert row.get("asr_language") in (None, "kn", "ta", "te", "ml", "hi", "mr", "gu", "bn", "pa", "ur", "ne", "as", "si", "sa", "en")
        if "iso_code" in row:
            assert len(row["iso_code"]) == 3 and row["iso_code"].islower()


def test_seed_loads_into_the_api(client, auth_headers):
    for row in json.loads(DATA.read_text()):
        assert client.post("/dialects", headers=auth_headers, json=row).status_code == 201
    listed = client.get("/dialects?page_size=200").json()
    tulu = next(d for d in listed if d["name"] == "Tulu")
    assert tulu["iso_code"] == "tcy" and tulu["asr_language"] == "kn"
