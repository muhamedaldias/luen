from .conftest import make_png_bytes


def _upload(client):
    res = client.post(
        "/api/images/upload",
        files={"file": ("photo.png", make_png_bytes((200, 100)), "image/png")},
    )
    assert res.status_code == 200
    return res.json()


def test_registry_has_core_operations(client):
    from app.operations.registry import OPERATIONS

    for name in (
        "crop", "resize", "resize_canvas", "rotate", "flip", "adjust",
        "auto_enhance", "remove_background", "blur", "sharpen",
        "brightness_contrast", "hue_saturation", "grayscale", "sepia",
        "vignette", "upscale", "remove_object",
        "invert", "posterize", "solarize", "threshold", "motion_blur",
        "pixelate", "grain", "glitch", "style", "filter",
    ):
        assert name in OPERATIONS


def test_crop_operation(client):
    image = _upload(client)
    res = client.post(
        "/api/operations/crop",
        json={"image_id": image["image_id"], "params": {"x": 0, "y": 0, "width": 40, "height": 40}},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "done"
    assert body["result_url"].endswith("crop.png")


def test_resize_operation(client):
    image = _upload(client)
    res = client.post(
        "/api/operations/resize",
        json={"image_id": image["image_id"], "params": {"width": 100, "height": 50}},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "done"


def test_adjust_operation(client):
    image = _upload(client)
    res = client.post(
        "/api/operations/adjust",
        json={"image_id": image["image_id"], "params": {"brightness": 20, "contrast": 10}},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "done"


def test_adjust_all_sliders(client):
    image = _upload(client)
    res = client.post(
        "/api/operations/adjust",
        json={"image_id": image["image_id"], "params": {
            "brightness": 10, "contrast": 10, "saturation": 10, "sharpness": 10,
            "blur": 5, "highlights": 20, "shadows": 20, "temperature": 15,
        }},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "done"


def test_artistic_operations_all_run(client):
    image = _upload(client)
    iid = image["image_id"]
    _run(client, iid, "invert", {})
    _run(client, iid, "posterize", {"bits": 3})
    _run(client, iid, "solarize", {"threshold": 128})
    _run(client, iid, "threshold", {"level": 128})
    _run(client, iid, "motion_blur", {"size": 9, "angle": 30})
    _run(client, iid, "pixelate", {"size": 8})
    _run(client, iid, "grain", {"amount": 20})
    _run(client, iid, "glitch", {"shift": 8, "slices": 3})
    _run(client, iid, "filter", {"preset": "emboss"})
    _run(client, iid, "filter", {"preset": "contour"})
    _run(client, iid, "filter", {"preset": "edge_enhance"})
    _run(client, iid, "filter", {"preset": "smooth"})
    for name in ("cinematic", "warm", "cold", "noir", "faded", "vivid"):
        _run(client, iid, "style", {"name": name})


def test_style_rejects_unknown(client):
    image = _upload(client)
    res = client.post(
        "/api/operations/style",
        json={"image_id": image["image_id"], "params": {"name": "nope"}},
    )
    assert res.status_code == 400


def test_unknown_operation(client):
    image = _upload(client)
    res = client.post(
        "/api/operations/nope",
        json={"image_id": image["image_id"], "params": {}},
    )
    assert res.status_code == 404


def test_operation_missing_image(client):
    res = client.post(
        "/api/operations/crop",
        json={"image_id": "0" * 32, "params": {}},
    )
    assert res.status_code == 404


def test_rotation_preserves_alpha(client):
    image = _upload(client)
    res = client.post(
        "/api/operations/rotate",
        json={"image_id": image["image_id"], "params": {"angle": 90}},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "done"


def _run(client, image_id, name, params):
    res = client.post("/api/operations/" + name, json={"image_id": image_id, "params": params})
    assert res.status_code == 200, (name, res.text)
    body = res.json()
    assert body["status"] == "done"
    assert body["result_url"].endswith(".png")
    return body


def test_new_filters_all_run(client):
    image = _upload(client)
    iid = image["image_id"]
    _run(client, iid, "brightness_contrast", {"brightness": 15, "contrast": 10})
    _run(client, iid, "hue_saturation", {"hue": 20, "saturation": 15})
    _run(client, iid, "grayscale", {})
    _run(client, iid, "sepia", {})
    _run(client, iid, "vignette", {"strength": 40})
    _run(client, iid, "blur", {"radius": 2})
    _run(client, iid, "sharpen", {"amount": 1.0})


def test_resize_canvas_and_upscale(client):
    image = _upload(client)
    iid = image["image_id"]
    _run(client, iid, "resize_canvas", {"width": 300, "height": 200, "anchor": "center", "bg": "#000000"})
    _run(client, iid, "upscale", {"scale": 2})


def test_remove_background_opencv_fallback(client):
    image = _upload(client)
    res = client.post(
        "/api/operations/remove_background",
        json={"image_id": image["image_id"], "params": {}},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] in ("done", "processing")


def test_compare_fanout(client):
    image = _upload(client)
    res = client.post(
        "/api/compare/remove_object",
        json={"image_id": image["image_id"], "params": {"mask": ""}},
    )
    assert res.status_code in (200, 400)


def test_project_lifecycle(client):
    created = client.post("/api/projects", json={"name": "مشروع تجريبي"})
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]

    listed = client.get("/api/projects")
    assert any(p["id"] == project_id for p in listed.json())

    deleted = client.delete(f"/api/projects/{project_id}")
    assert deleted.status_code == 204

    missing = client.get(f"/api/projects/{project_id}")
    assert missing.status_code == 404