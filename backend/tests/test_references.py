import httpx

from app.routers import references


class FakeResponse:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


def page(title, url, licence, mime="audio/ogg", artist="<a>Speaker</a>"):
    return {"title": f"File:{title}", "imageinfo": [{
        "url": url, "descriptionurl": url + ".page", "mime": mime,
        "extmetadata": {"LicenseShortName": {"value": licence}, "Artist": {"value": artist},
                        "ImageDescription": {"value": "<p>A song</p>"}},
    }]}


def test_open_licence():
    assert references.open_licence("CC BY-SA 4.0")
    assert references.open_licence("CC0")
    assert references.open_licence("Public domain")
    assert not references.open_licence("CC BY-NC-SA 4.0")
    assert not references.open_licence("CC BY-ND 4.0")


def test_search_commons(client, admin_headers, monkeypatch):
    d = client.post("/dialects", json={"name": "Tulu", "iso_code": "tcy"}, headers=admin_headers).json()
    calls = []

    def fake_get(url, params, headers, timeout):
        calls.append(params["gsrsearch"])
        assert "SwaraVeda" in headers["User-Agent"]
        return FakeResponse({"query": {"pages": [
            page("LL-Q34251 (tcy)-Speaker-ಮಳೆ.wav", "https://upload.wikimedia.org/a.wav", "CC BY-SA 4.0", "audio/wav"),
            page("Tulu song.ogg", "https://upload.wikimedia.org/b.ogg", "CC BY-NC 4.0"),
            page("Picture.jpg", "https://upload.wikimedia.org/c.jpg", "CC0", "image/jpeg"),
        ]}})

    monkeypatch.setattr(references.httpx, "get", fake_get)
    resp = client.get(f"/references/commons?dialect_id={d['id']}", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    results = resp.json()["results"]
    assert calls == ['intitle:"(tcy)" filetype:audio', '"Tulu" filetype:audio']
    assert [r["audio_url"] for r in results] == ["https://upload.wikimedia.org/a.wav", "https://upload.wikimedia.org/b.ogg"]
    word = results[0]
    assert word["word"] == "ಮಳೆ" and word["open_licence"] and word["author"] == "Speaker" and not word["already_added"]
    assert results[1]["open_licence"] is False


def test_search_commons_needs_verifier(client, auth_headers, admin_headers):
    d = client.post("/dialects", json={"name": "Toda"}, headers=admin_headers).json()
    assert client.get(f"/references/commons?dialect_id={d['id']}", headers=auth_headers).status_code == 403


def test_search_commons_unreachable(client, admin_headers, monkeypatch):
    d = client.post("/dialects", json={"name": "Kota"}, headers=admin_headers).json()

    def boom(*a, **k):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(references.httpx, "get", boom)
    assert client.get(f"/references/commons?dialect_id={d['id']}", headers=admin_headers).status_code == 502
