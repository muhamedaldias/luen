"""Regression tests for adjust-parameter parity between the two engines.

The browser path (src/lib/localOps.ts) has always honoured exposure, whites and
blacks, and the Adjust panel has always sent all three. The backend accepted
the request and silently ignored them, so those sliders did nothing whenever
the FastAPI service was connected. These tests pin the backend to the same
parameter set and to the same curve shape as the local path.
"""

from io import BytesIO

import numpy as np
from PIL import Image

from .conftest import make_png_bytes


def _upload(client):
    res = client.post(
        "/api/images/upload",
        files={"file": ("photo.png", make_png_bytes((64, 48)), "image/png")},
    )
    assert res.status_code == 200, res.text
    return res.json()


def _adjust(client, image_id, **params):
    res = client.post(
        "/api/operations/adjust",
        json={"image_id": image_id, "params": params},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "done"
    return body["result_url"]


def _mean_luma(client, result_url):
    res = client.get(result_url)
    assert res.status_code == 200, res.text
    img = Image.open(BytesIO(res.content)).convert("L")
    return float(np.asarray(img, dtype=np.float32).mean())


def test_whites_blacks_curve_is_identity_when_neutral():
    from app.operations.classical import _whites_blacks_curve

    ramp = np.arange(256, dtype=np.float32)
    assert np.allclose(_whites_blacks_curve(ramp, 0, 0), ramp, atol=1e-4)


def test_whites_blacks_curve_direction_and_independence():
    from app.operations.classical import _whites_blacks_curve

    ramp = np.arange(256, dtype=np.float32)

    # Positive values lift the tone, negative values pull it down (Lightroom).
    assert _whites_blacks_curve(ramp, 0, 50)[10] > ramp[10]
    assert _whites_blacks_curve(ramp, 0, -50)[10] < ramp[10]
    assert _whites_blacks_curve(ramp, -50, 0)[250] < ramp[250]

    # Each control is computed from the original tone, so on mid-tones (where the
    # output clamp does not saturate) the two add instead of compounding.
    mid = ramp[20:200]
    assert np.allclose(
        _whites_blacks_curve(mid, 10, 10),
        _whites_blacks_curve(mid, 10, 0) + _whites_blacks_curve(mid, 0, 10) - mid,
        atol=1e-3,
    )


def test_adjust_honours_exposure(client):
    """exposure=+100 is a 2x gain, so the result must be clearly brighter."""
    image = _upload(client)
    neutral = _mean_luma(client, _adjust(client, image["image_id"]))
    bright = _mean_luma(client, _adjust(client, image["image_id"], exposure=100))
    assert bright > neutral + 20, f"exposure was ignored: {neutral:.1f} -> {bright:.1f}"


def test_adjust_honours_whites_and_blacks(client):
    image = _upload(client)
    neutral = _mean_luma(client, _adjust(client, image["image_id"]))
    whites = _mean_luma(client, _adjust(client, image["image_id"], whites=100))
    blacks = _mean_luma(client, _adjust(client, image["image_id"], blacks=100))
    assert whites > neutral, f"whites was ignored: {neutral:.1f} -> {whites:.1f}"
    assert blacks > neutral, f"blacks was ignored: {neutral:.1f} -> {blacks:.1f}"


def test_adjust_without_params_does_not_alter_the_image(client):
    """An empty adjust has to round-trip the image, not return a black frame.

    The Lab step used to call cvtColor on float32 pixels that were still scaled
    0-255. OpenCV reads float RGB as 0-1, so the round-trip left the valid range
    and every backend-side adjust came back black. Only a pixel comparison
    catches this: the operation still returned 200 with a decodable PNG.
    """
    image = _upload(client)
    neutral = _mean_luma(client, _adjust(client, image["image_id"]))
    # make_png_bytes fills the frame with rgb(200, 120, 40); this is its luma.
    expected = 0.299 * 200 + 0.587 * 120 + 0.114 * 40
    assert abs(neutral - expected) < 6, (
        f"empty adjust altered the image: luma {neutral:.1f}, expected about {expected:.1f}"
    )
