"""Artistic and stylistic operations: tones, blurs, texture and LUT looks.

Every handler follows the module convention:
    (image_id, user_id, params) -> result_url
RGB pipeline with the alpha channel preserved and re-attached.
"""

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from . import load_original, save_result


def _float(params: dict, key: str, default: float) -> float:
    try:
        return float(params.get(key, default))
    except (TypeError, ValueError):
        return default


def _load(image_id: str, user_id: str) -> Image.Image:
    return load_original(user_id, image_id)


def _alpha_of(img: Image.Image):
    return img.getchannel("A") if img.mode == "RGBA" else None


def _finish(rgb: Image.Image, alpha, user_id: str, image_id: str, op: str) -> str:
    if alpha is not None:
        rgb = rgb.convert("RGB")
        rgb.putalpha(alpha)
    return save_result(rgb, user_id, image_id, op)


def invert(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    return _finish(ImageOps.invert(img.convert("RGB")), _alpha_of(img), user_id, image_id, "invert")


def posterize(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    bits = min(7, max(1, int(_float(params, "bits", 3))))
    return _finish(ImageOps.posterize(img.convert("RGB"), bits), _alpha_of(img), user_id, image_id, "posterize")


def solarize(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    threshold = min(255, max(0, int(_float(params, "threshold", 128))))
    return _finish(ImageOps.solarize(img.convert("RGB"), threshold), _alpha_of(img), user_id, image_id, "solarize")


def threshold(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    level = min(255, max(0, int(_float(params, "level", 128))))
    bw = img.convert("L").point(lambda v: 255 if v > level else 0)
    return _finish(bw.convert("RGB"), _alpha_of(img), user_id, image_id, "threshold")


def motion_blur(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    size = min(51, max(3, int(_float(params, "size", 15))))
    if size % 2 == 0:
        size += 1
    angle = float(params.get("angle", 0)) % 180.0
    kernel = np.zeros((size, size), dtype=np.float32)
    r = (size - 1) / 2.0
    rad = np.deg2rad(angle)
    dx, dy = np.cos(rad), np.sin(rad)
    for i in range(size):
        t = -r + i
        x = int(round(r + t * dx))
        y = int(round(r + t * dy))
        kernel[y, x] = 1.0
    kernel /= kernel.sum()
    arr = np.array(img.convert("RGB"))
    blurred = cv2.filter2D(arr, -1, kernel)
    return _finish(Image.fromarray(blurred), _alpha_of(img), user_id, image_id, "motion_blur")


def radial_blur(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id).convert("RGB")
    strength = min(100.0, max(0.0, _float(params, "strength", 40)))
    if strength <= 0:
        return _finish(img, _alpha_of(img), user_id, image_id, "radial_blur")
    samples = 8
    w, h = img.size
    acc = np.zeros((h, w, 3), dtype=np.float32)
    for i in range(samples):
        z = 1.0 + (strength / 100.0) * 0.25 * (i / max(1, samples - 1))
        zw, zh = max(w, int(w * z)), max(h, int(h * z))
        big = img.resize((zw, zh), Image.BILINEAR)
        left, top = (zw - w) // 2, (zh - h) // 2
        acc += np.array(big.crop((left, top, left + w, top + h)), dtype=np.float32)
    acc /= samples
    return _finish(Image.fromarray(np.clip(acc, 0, 255).astype(np.uint8)), _alpha_of(img), user_id, image_id, "radial_blur")


def pixelate(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    size = min(64, max(2, int(_float(params, "size", 12))))
    rgb = img.convert("RGB")
    w, h = rgb.size
    small = rgb.resize((max(1, w // size), max(1, h // size)), Image.BOX)
    out = small.resize((w, h), Image.NEAREST)
    return _finish(out, _alpha_of(img), user_id, image_id, "pixelate")


def denoise(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    strength = min(20.0, max(1.0, _float(params, "strength", 7)))
    bgr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    clean = cv2.fastNlMeansDenoisingColored(bgr, None, strength, strength, 7, 21)
    rgb = cv2.cvtColor(clean, cv2.COLOR_BGR2RGB)
    return _finish(Image.fromarray(rgb), _alpha_of(img), user_id, image_id, "denoise")


def grain(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    amount = min(100.0, max(0.0, _float(params, "amount", 25)))
    arr = np.array(img.convert("RGB"), dtype=np.float32)
    if amount > 0:
        rng = np.random.default_rng(7)
        noise = rng.normal(0.0, amount * 0.9, arr.shape).astype(np.float32)
        arr = np.clip(arr + noise, 0, 255)
    return _finish(Image.fromarray(arr.astype(np.uint8)), _alpha_of(img), user_id, image_id, "grain")


def glitch(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    shift = min(60, max(0, int(_float(params, "shift", 18))))
    slices = min(12, max(2, int(_float(params, "slices", 5))))
    seed = int(_float(params, "seed", 7))
    arr = np.array(img.convert("RGB"))
    h, w, _ = arr.shape
    r, g, b = arr[:, :, 0].copy(), arr[:, :, 1].copy(), arr[:, :, 2].copy()
    if shift > 0:
        r = np.roll(r, shift, axis=1)
        b = np.roll(b, -shift, axis=1)
    out = np.stack([r, g, b], axis=2)
    rng = np.random.default_rng(seed)
    edges = sorted(rng.integers(0, h, size=slices + 1).tolist())
    for i in range(len(edges) - 1):
        y0, y1 = edges[i], edges[i + 1]
        if y1 <= y0:
            continue
        off = int(rng.integers(-shift * 2, shift * 2 + 1))
        if off:
            out[y0:y1] = np.roll(out[y0:y1], off, axis=1)
    return _finish(Image.fromarray(out), _alpha_of(img), user_id, image_id, "glitch")


def _scurve(a: np.ndarray, amount: float) -> np.ndarray:
    return np.clip((a - 127.5) * amount + 127.5, 0, 255)


def _style_cinematic(a: np.ndarray) -> np.ndarray:
    lum = a.mean(axis=2, keepdims=True) / 255.0
    out = a.copy()
    out[:, :, 0] += (lum[:, :, 0] - 0.5) * 44 + 6
    out[:, :, 2] -= (lum[:, :, 0] - 0.5) * 30 - 8
    return _scurve(out, 1.08)


def _style_warm(a: np.ndarray) -> np.ndarray:
    out = a.copy()
    out[:, :, 0] += 18
    out[:, :, 2] -= 18
    return out


def _style_cold(a: np.ndarray) -> np.ndarray:
    out = a.copy()
    out[:, :, 0] -= 16
    out[:, :, 2] += 22
    return out


def _style_noir(a: np.ndarray) -> np.ndarray:
    gray = a.mean(axis=2, keepdims=True)
    gray = np.repeat(_scurve(gray, 1.35), 3, axis=2)
    return gray


def _style_faded(a: np.ndarray) -> np.ndarray:
    out = a * 0.85 + 30
    out[:, :, 0] += 10
    return out


def _style_vivid(a: np.ndarray) -> np.ndarray:
    return _scurve(a, 1.12)


STYLES = {
    "cinematic": ("Cinematic", _style_cinematic, True),
    "warm": ("Warm", _style_warm, True),
    "cold": ("Cold", _style_cold, True),
    "noir": ("Noir", _style_noir, False),
    "faded": ("Faded", _style_faded, True),
    "vivid": ("Vivid", _style_vivid, True),
}


def style(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    name = str(params.get("name", "cinematic")).lower()
    if name not in STYLES:
        raise ValueError(f"unknown style: {name}")
    label, func, boost_sat = STYLES[name]
    del label
    arr = np.array(img.convert("RGB"), dtype=np.float32)
    out = np.clip(func(arr), 0, 255).astype(np.uint8)
    result = Image.fromarray(out)
    if boost_sat:
        result = ImageEnhance.Color(result).enhance(1.12)
    return _finish(result, _alpha_of(img), user_id, image_id, "style")
