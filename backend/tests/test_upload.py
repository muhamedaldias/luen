from .conftest import make_png_bytes


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"


def test_upload_valid_png(client):
    res = client.post(
        "/api/images/upload",
        files={"file": ("photo.png", make_png_bytes(), "image/png")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["width"] == 64
    assert body["height"] == 48
    assert body["image_id"]
    assert body["url"].endswith("original.png")


def test_upload_serves_file(client):
    res = client.post(
        "/api/images/upload",
        files={"file": ("photo.png", make_png_bytes(), "image/png")},
    )
    image_id = res.json()["image_id"]

    served = client.get(f"/api/storage/local/{image_id}/original.png")
    assert served.status_code == 200
    assert served.headers["content-type"].startswith("image/png")


def test_upload_rejects_junk(client):
    res = client.post(
        "/api/images/upload",
        files={"file": ("junk.png", b"not-an-image", "image/png")},
    )
    assert res.status_code == 400


def test_upload_rejects_oversize(client):
    big = b"0" * (1024 * 1024 + 1)
    res = client.post(
        "/api/images/upload",
        files={"file": ("big.png", big, "image/png")},
    )
    assert res.status_code == 413


def test_upload_invalid_path(client):
    res = client.get("/api/storage/local/../../etc/passwd.png")
    assert res.status_code == 404 or res.status_code == 400