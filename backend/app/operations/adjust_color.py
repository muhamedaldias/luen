import json

import numpy as np

try:
    import cv2  # noqa: F401  (optional; LUT applied via numpy so cv2 not required)
except ImportError:  # pragma: no cover
    cv2 = None

from PIL import Image

from . import save_result
from .classical import _float_params, _int_param, _load


_CHANNELS = ("rgb", "r", "g", "b")


def _norm_channel(value: object) -> str:
    ch = str(value or "rgb").lower()
    return ch if ch in _CHANNELS else "rgb"


def _channel_indices(channel: str) -> tuple:
    if channel == "r":
        return (0,)
    if channel == "g":
        return (1,)
    if channel == "b":
        return (2,)
    return (0, 1, 2)


def _build_levels_lut(
    shadows: int, gamma: float, highlights: int, out_min: int, out_max: int
) -> np.ndarray:
    shadows = max(0, min(255, shadows))
    highlights = max(0, min(255, highlights))
    out_min = max(0, min(255, out_min))
    out_max = max(0, min(255, out_max))
    gamma = max(0.1, min(10.0, gamma))
    if highlights <= shadows:
        highlights = min(255, shadows + 1)
    x = np.arange(256, dtype=np.float32)
    # 1) input range stretch
    lut = (x - shadows) / float(highlights - shadows) * 255.0
    lut = np.clip(lut, 0.0, 255.0)
    # 2) gamma on normalized range
    lut = 255.0 * np.power(lut / 255.0, gamma)
    # 3) output range mapping
    lut = out_min + (lut / 255.0) * float(out_max - out_min)
    return np.clip(lut, 0, 255).astype(np.uint8)


def _parse_points(raw: object) -> list:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            raise ValueError("params.points must be a JSON array of {x, y}") from None
    if not isinstance(raw, (list, tuple)) or len(raw) < 2:
        raise ValueError("params.points needs at least 2 control points")
    pts = []
    for p in raw:
        if not isinstance(p, dict):
            raise ValueError("each point must be {x, y}")
        try:
            x = float(p.get("x", 0))
            y = float(p.get("y", 0))
        except (TypeError, ValueError):
            raise ValueError("each point must be {x, y} numbers") from None
        pts.append((max(0.0, min(255.0, x)), max(0.0, min(255.0, y))))
    pts.sort(key=lambda t: t[0])
    # drop duplicate x (keep last y) so the spline system stays non-singular
    dedup: list = []
    for x, y in pts:
        if dedup and abs(dedup[-1][0] - x) < 1e-6:
            dedup[-1] = (x, y)
        else:
            dedup.append((x, y))
    if len(dedup) < 2:
        raise ValueError("params.points needs at least 2 distinct x values")
    return dedup


def _cubic_spline_lut(pts: list) -> np.ndarray:
    """Natural cubic spline through control points, sampled at 0..255."""
    xs = np.array([p[0] for p in pts], dtype=np.float64)
    ys = np.array([p[1] for p in pts], dtype=np.float64)
    n = len(xs)
    if n == 2:
        # straight line between the two points
        x = np.arange(256, dtype=np.float64)
        return np.clip(np.interp(x, xs, ys), 0, 255).astype(np.uint8)
    h = np.diff(xs)
    # natural spline: M[0] = M[n-1] = 0, solve tridiagonal for interior M
    a = h[:-1]
    b = 2.0 * (h[:-1] + h[1:])
    c = h[1:]
    d = 6.0 * ((ys[2:] - ys[1:-1]) / h[1:] - (ys[1:-1] - ys[:-2]) / h[:-1])
    # Thomas algorithm
    cp = np.zeros(n - 2)
    dp = np.zeros(n - 2)
    cp[0] = c[0] / b[0]
    dp[0] = d[0] / b[0]
    for i in range(1, n - 2):
        denom = b[i] - a[i] * cp[i - 1]
        if abs(denom) < 1e-12:
            denom = 1e-12
        cp[i] = c[i] / denom if i < n - 3 else 0.0
        dp[i] = (d[i] - a[i] * dp[i - 1]) / denom
    m_inner = np.zeros(n - 2)
    m_inner[-1] = dp[-1]
    for i in range(n - 4, -1, -1):
        m_inner[i] = dp[i] - cp[i] * m_inner[i + 1]
    m = np.zeros(n)
    m[1:-1] = m_inner

    x = np.arange(256, dtype=np.float64)
    idx = np.clip(np.searchsorted(xs, x, side="right") - 1, 0, n - 2)
    dx = x - xs[idx]
    hi = h[idx]
    hi = np.where(hi < 1e-12, 1e-12, hi)
    y = (
        m[idx] * (hi - dx) ** 3 / (6.0 * hi)
        + m[idx + 1] * dx**3 / (6.0 * hi)
        + (ys[idx] - m[idx] * hi**2 / 6.0) * (hi - dx) / hi
        + (ys[idx + 1] - m[idx + 1] * hi**2 / 6.0) * dx / hi
    )
    return np.clip(y, 0, 255).astype(np.uint8)


def _apply_lut(img: Image.Image, lut: np.ndarray, channel: str) -> Image.Image:
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    arr = np.array(img.convert("RGB"), dtype=np.uint8)
    for ci in _channel_indices(_norm_channel(channel)):
        arr[:, :, ci] = lut[arr[:, :, ci]]
    result = Image.fromarray(arr, "RGB")
    if alpha is not None:
        result.putalpha(alpha)
    return result


def levels(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    shadows = _int_param(params, "shadows", 0)
    highlights = _int_param(params, "highlights", 255)
    gamma = _float_params(params, "gamma", 1.0)
    # alias: frontend "midtones" slider maps to gamma
    if "gamma" not in params and "midtones" in params:
        gamma = _float_params(params, "midtones", 1.0)
    out_min = _int_param(params, "output_min", 0)
    out_max = _int_param(params, "output_max", 255)
    channel = _norm_channel(params.get("channel", "rgb"))
    lut = _build_levels_lut(shadows, gamma, highlights, out_min, out_max)
    return save_result(_apply_lut(img, lut, channel), user_id, image_id, "levels")


def curves(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    pts = _parse_points(params.get("points"))
    channel = _norm_channel(params.get("channel", "rgb"))
    lut = _cubic_spline_lut(pts)
    return save_result(_apply_lut(img, lut, channel), user_id, image_id, "curves")


def _clamp100(value: object) -> float:
    try:
        return max(-100.0, min(100.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def color_balance(image_id: str, user_id: str, params: dict) -> str:
    """Per-range color balance: cyan/red, magenta/green, yellow/blue shifts."""
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    ranges = ("shadows", "midtones", "highlights")
    cfg = [
        (
            _clamp100(params.get(f"{p}_cyan_red", 0)),
            _clamp100(params.get(f"{p}_magenta_green", 0)),
            _clamp100(params.get(f"{p}_yellow_blue", 0)),
        )
        for p in ranges
    ]
    preserve = str(params.get("preserve_luminosity", 1)).lower() not in ("0", "false", "no", "off")
    arr = np.array(img.convert("RGB"), dtype=np.float32)
    lum = arr.mean(axis=2) / 255.0
    masks = [(1.0 - lum) ** 2, 4.0 * lum * (1.0 - lum), lum**2]
    shift = np.zeros_like(arr)
    for k in range(3):
        m = masks[k]
        if float(m.max()) <= 0:
            continue
        cr, mg, yb = cfg[k]
        da = ((cr + mg) / 100.0) * m * 25.0
        dyb = (yb / 100.0) * m * 25.0
        shift[:, :, 0] += da / 2.0 + dyb / 4.0
        shift[:, :, 1] += -da / 2.0 + dyb / 4.0
        shift[:, :, 2] += -dyb / 2.0
    out = arr + shift
    if preserve:
        old_luma = arr.mean(axis=2)
        new_luma = np.clip(out, 0, 255).mean(axis=2)
        out = out + (old_luma - new_luma)[:, :, None]
    result = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    if alpha is not None:
        result.putalpha(alpha)
    return save_result(result, user_id, image_id, "color_balance")


def _rgb_to_hsv(arr: np.ndarray) -> np.ndarray:
    """Vectorized RGB [0,1] -> HSV (h in degrees, s/v in [0,1])."""
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    diff = mx - mn
    h = np.zeros_like(mx)
    mask = diff > 1e-9
    r_is = mask & (mx == r)
    g_is = mask & (mx == g)
    b_is = mask & (mx == b)
    h[r_is] = (60.0 * ((g[r_is] - b[r_is]) / diff[r_is]) + 360.0) % 360.0
    h[g_is] = 60.0 * ((b[g_is] - r[g_is]) / diff[g_is]) + 120.0
    h[b_is] = 60.0 * ((r[b_is] - g[b_is]) / diff[b_is]) + 240.0
    s = np.where(mx > 1e-9, diff / np.maximum(mx, 1e-9), 0.0)
    return np.stack([h, s, mx], axis=2)


def _hsv_to_rgb(hsv: np.ndarray) -> np.ndarray:
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    c = v * s
    hp = (h / 60.0) % 6.0
    x = c * (1.0 - np.abs(hp % 2.0 - 1.0))
    z = np.zeros_like(c)
    conds = [hp < 1, hp < 2, hp < 3, hp < 4, hp < 5, hp <= 6]
    rs = np.select(conds, [c, x, z, z, x, c], default=z)
    gs = np.select(conds, [x, c, c, x, z, z], default=z)
    bs = np.select(conds, [z, z, x, c, c, x], default=z)
    m = v - c
    return np.stack([rs + m, gs + m, bs + m], axis=2)


def vibrance(image_id: str, user_id: str, params: dict) -> str:
    """Smart saturation: boosts dull colors more, shields skin tones."""
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    amount = _clamp100(params.get("amount", 30))
    arr = np.array(img.convert("RGB"), dtype=np.float32) / 255.0
    if amount != 0:
        hsv = _rgb_to_hsv(arr)
        h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        boost = (1.0 - s) * (amount / 100.0) * 0.5
        skin = ((h < 60.0) | (h > 330.0)) & (s < 0.6) & (v > 0.2)
        boost = np.where(skin, boost * 0.25, boost)
        hsv[:, :, 1] = np.clip(s + boost, 0.0, 1.0)
        arr = _hsv_to_rgb(hsv)
    result = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGB")
    if alpha is not None:
        result.putalpha(alpha)
    return save_result(result, user_id, image_id, "vibrance")


def _clamp100(value: object) -> float:
    try:
        v = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    return max(-100.0, min(100.0, v))


def _range_params(params: dict, prefix: str) -> tuple:
    """Accept nested {prefix: {cyan_red, ...}} or flat {prefix_cyan_red, ...} keys."""
    nested = params.get(prefix)
    if isinstance(nested, dict):
        return (
            _clamp100(nested.get("cyan_red", 0)),
            _clamp100(nested.get("magenta_green", 0)),
            _clamp100(nested.get("yellow_blue", 0)),
        )
    return (
        _clamp100(params.get(f"{prefix}_cyan_red", 0)),
        _clamp100(params.get(f"{prefix}_magenta_green", 0)),
        _clamp100(params.get(f"{prefix}_yellow_blue", 0)),
    )


def _truthy(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def color_balance(image_id: str, user_id: str, params: dict) -> str:
    """Photoshop-style color balance per tonal range in LAB space.

    params: shadows/midtones/highlights each {cyan_red, magenta_green, yellow_blue}
            (-100..100, nested dict or flat `shadows_cyan_red` keys),
            preserve_luminosity: bool (rescale L to original mean).
    """
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    rgb = np.array(img.convert("RGB"), dtype=np.uint8)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    l_orig = lab[:, :, 0].copy()

    ln = lab[:, :, 0] / 255.0
    masks = {
        "shadows": (1.0 - ln) ** 2,
        "highlights": ln**2,
        "midtones": 4.0 * ln * (1.0 - ln),
    }

    for name, mask in masks.items():
        cr, mg, yb = _range_params(params, name)
        if cr == 0 and mg == 0 and yb == 0:
            continue
        # In LAB, +a ≈ red/magenta, -a ≈ green/cyan; +b ≈ yellow, -b ≈ blue.
        # Cyan-Red and Magenta-Green both shift the a axis; Yellow-Blue shifts b.
        da = (cr + mg) / 100.0 * mask * 25.0
        db = yb / 100.0 * mask * 25.0
        lab[:, :, 1] = np.clip(lab[:, :, 1] + da, 0, 255)
        lab[:, :, 2] = np.clip(lab[:, :, 2] + db, 0, 255)

    if _truthy(params.get("preserve_luminosity", False)):
        shift = float(l_orig.mean() - lab[:, :, 0].mean())
        lab[:, :, 0] = np.clip(lab[:, :, 0] + shift, 0, 255)

    out = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    result = Image.fromarray(out, "RGB")
    if alpha is not None:
        result.putalpha(alpha)
    return save_result(result, user_id, image_id, "color_balance")


def vibrance(image_id: str, user_id: str, params: dict) -> str:
    """Vibrance: boost saturation of dull pixels, protect skin tones.

    params: amount (-100..100).
    """
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    amount = _clamp100(params.get("amount", 0))
    if amount == 0:
        result = img.convert("RGB")
        if alpha is not None:
            result.putalpha(alpha)
        return save_result(result, user_id, image_id, "vibrance")

    bgr = np.array(img.convert("RGB"))[:, :, ::-1]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h_deg = hsv[:, :, 0] * 2.0  # OpenCV H 0..179 -> degrees
    s = hsv[:, :, 1] / 255.0
    v = hsv[:, :, 2] / 255.0

    boost = (1.0 - s) * (amount / 100.0) * 0.5
    skin = ((h_deg < 60.0) | (h_deg > 330.0)) & (s < 0.6) & (v > 0.2)
    boost = np.where(skin, boost * 0.25, boost)

    hsv[:, :, 1] = np.clip((s + boost) * 255.0, 0, 255)
    bgr_out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    result = Image.fromarray(bgr_out[:, :, ::-1], "RGB")
    if alpha is not None:
        result.putalpha(alpha)
    return save_result(result, user_id, image_id, "vibrance")
