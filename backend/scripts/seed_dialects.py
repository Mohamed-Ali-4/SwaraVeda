"""Adds the dialects in data/dialects.json to a running SwaraVeda API,
skipping any whose name already exists. Safe to run again.

    SWARAVEDA_EMAIL=you@example.com SWARAVEDA_PASSWORD=... \\
        python -m scripts.seed_dialects https://swaraveda-api.onrender.com

Without the environment variables it asks for the email and password.
"""
import getpass
import json
import os
import sys
from pathlib import Path

import httpx

DATA = Path(__file__).resolve().parent.parent / "data" / "dialects.json"


def main(api: str) -> None:
    api = api.rstrip("/")
    email = os.environ.get("SWARAVEDA_EMAIL") or input("Email: ")
    password = os.environ.get("SWARAVEDA_PASSWORD") or getpass.getpass("Password: ")
    with httpx.Client(base_url=api, timeout=60) as client:
        login = client.post("/auth/login", json={"email": email, "password": password})
        login.raise_for_status()
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

        existing = {d["name"].lower() for d in client.get("/dialects", params={"page_size": 200}).json()}
        added = 0
        for dialect in json.loads(DATA.read_text()):
            if dialect["name"].lower() in existing:
                continue
            resp = client.post("/dialects", json=dialect)
            if resp.status_code != 201:
                print(f"  ✗ {dialect['name']}: {resp.status_code} {resp.text[:200]}")
                continue
            added += 1
            print(f"  + {dialect['name']}")
        print(f"Added {added}; {len(existing)} already there.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000")
