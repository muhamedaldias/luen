import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None

from PIL import Image, ImageEnhance

from . import save_result


def _bgr_from(img: Image.Image) -> np.ndarray:
    rgb = img.convert("RGB")
    bgr = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
    return bgr


def _to_pil(bgr: np.ndarray, alpha: Image.Image | None) -> Image.Image:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    result = Image.fromarray(rgb)
    if alpha is not None:
        result.putalpha(alpha)
    return result


def _float_params(params: dict, key: str, default: float) -> float:
    try:
        return float(params.get(key, default))
    except (TypeError, ValueError):
        return default


def _int_param(params: dict, key: str, default: int) -> int:
    try:
        return int(params.get(key, default))
    except (TypeError, ValueError):
        return default


def crop(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    x = _int_param(params, "x", 0)
    y = _int_param(params, "y", 0)
    width = _int_param(params, "width", img.width)
    height = _int_param(params, "height", img.height)
    box = img.crop((x, y, min(x + width, img.width), min(y + height, img.height)))
    return save_result(box, user_id, image_id, "crop")


def resize(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    width = _int_param(params, "width", img.width)
    height = _int_param(params, "height", img.height)
    width = max(1, min(width, 20000))
    height = max(1, min(height, 20000))
    downscale = width * height <= img.width * img.height
    resample = Image.LANCZOS if downscale else Image.Resampling.LANCZOS
    result = img.resize((width, height), resample)
    return save_result(result, user_id, image_id, "resize")


def rotate(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    angle = float(params.get("angle", 0)) % 360
    result = img.rotate(angle, expand=True, resample=Image.BICUBIC)
    return save_result(result, user_id, image_id, "rotate")


def flip(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    axis = str(params.get("axis", "horizontal"))
    result = img.transpose(Image.FLIP_LEFT_RIGHT if axis == "horizontal" else Image.FLIP_TOP_BOTTOM)
    return save_result(result, user_id, image_id, "flip")


_ANCHORS = {
    "topleft": (0.0, 0.0),
    "top": (0.5, 0.0),
    "topright": (1.0, 0.0),
    "left": (0.0, 0.5),
    "center": (0.5, 0.5),
    "right": (1.0, 0.5),
    "bottomleft": (0.0, 1.0),
    "bottom": (0.5, 1.0),
    "bottomright": (1.0, 1.0),
}


def _parse_hex_color(value: object, default: tuple = (28, 27, 26)) -> tuple:
    try:
        s = str(value).strip().lstrip("#")
        if len(s) == 3:
            s = "".join(c * 2 for c in s)
        if len(s) != 6:
            return default
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
    except (TypeError, ValueError):
        return default


def resize_canvas(image_id: str, user_id: str, params: dict) -> str:
    """تغيير أبعاد اللوحة دون تحجيم المحتوى: لصق + اقتصاص حسب anchor."""
    from ..config import get_settings

    img = _load(image_id, user_id).convert("RGBA")
    target_w = max(1, min(_int_param(params, "width", img.width), 20000))
    target_h = max(1, min(_int_param(params, "height", img.height), 20000))
    if target_w * target_h > int(get_settings().max_image_pixels):
        raise ValueError("target canvas exceeds pixel limit")
    anchor = str(params.get("anchor", "center")).lower()
    ax, ay = _ANCHORS.get(anchor, (0.5, 0.5))
    bg = _parse_hex_color(params.get("bg", "#1C1B1A"))

    src = np.array(img)  # RGBA
    sh, sw = src.shape[:2]
    canvas = np.zeros((target_h, target_w, 4), dtype=np.uint8)
    canvas[:, :] = (bg[0], bg[1], bg[2], 255)

    ox = int(round((target_w - sw) * ax))
    oy = int(round((target_h - sh) * ay))
    # منطقة التداخل (تقتص الزائد تلقائياً)
    sx0, sy0 = max(0, -ox), max(0, -oy)
    dx0, dy0 = max(0, ox), max(0, oy)
    w = min(sw - sx0, target_w - dx0)
    h = min(sh - sy0, target_h - dy0)
    if w > 0 and h > 0:
        canvas[dy0:dy0 + h, dx0:dx0 + w] = src[sy0:sy0 + h, sx0:sx0 + w]
    return save_result(Image.fromarray(canvas, "RGBA"), user_id, image_id, "resize_canvas")


def affine(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    bgr = _bgr_from(img)
    matrix = params.get("matrix")
    if isinstance(matrix, (list, tuple)) and len(matrix) == 6:
        try:
            m = np.array([float(v) for v in matrix], dtype=np.float64).reshape(2, 3)
        except (TypeError, ValueError):
            raise ValueError("matrix must be 6 numbers") from None
    else:
        raise ValueError("params.matrix is required: [a, b, c, d, e, f]")
    transformed = cv2.warpAffine(bgr, m, (bgr.shape[1], bgr.shape[0]), flags=cv2.INTER_LANCZOS4)
    return save_result(_to_pil(transformed, alpha), user_id, image_id, "affine")


def adjust(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None

    brightness = _float_params(params, "brightness", 0)
    contrast = _float_params(params, "contrast", 0)
    saturation = _float_params(params, "saturation", 0)

    rgb = np.array(img.convert("RGB"), dtype=np.float32)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l_channel = lab[:, :, 0]

    if brightness:
        l_channel = np.clip(l_channel + brightness, 0, 255)
    if contrast:
        scale = 1 + contrast / 100.0
        l_channel = np.clip((l_channel - 128) * scale + 128, 0, 255)
    lab[:, :, 0] = l_channel
    rgb_out = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
    result = Image.fromarray(np.clip(rgb_out, 0, 255).astype(np.uint8))

    if saturation:
        result = ImageEnhance.Color(result).enhance(1 + saturation / 100.0)
    sharpness = _float_params(params, "sharpness", 0)
    if sharpness:
        result = ImageEnhance.Sharpness(result).enhance(1 + sharpness / 200.0)

    if alpha is not None:
        result.putalpha(alpha)
    return save_result(result, user_id, image_id, "adjust")


def clahe(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    bgr = _bgr_from(img)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clip = float(params.get("clip_limit", 2.0))
    tile = int(params.get("tile_size", 8))
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile))
    l = clahe.apply(l)
    merged = cv2.merge((l, a, b))
    result = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    return save_result(_to_pil(result, alpha), user_id, image_id, "auto_enhance")


def _load(image_id: str, user_id: str) -> Image.Image:
    from . import load_original

    return load_original(user_id, image_id)