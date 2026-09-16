import base64
import io

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None

from PIL import Image, ImageFilter

from . import save_result
from .classical import _bgr_from, _float_params, _int_param, _load, _to_pil


def filter_preset(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    preset = str(params.get("preset", "blur"))
    alpha = img.getchannel("A") if img.mode == "RGBA" else None

    presets = {
        "edge_enhance": lambda im: im.filter(ImageFilter.EDGE_ENHANCE),
        "emboss": lambda im: im.filter(ImageFilter.EMBOSS),
        "contour": lambda im: im.filter(ImageFilter.CONTOUR),
        "smooth": lambda im: im.filter(ImageFilter.SMOOTH),
        "median": lambda im: im.filter(ImageFilter.MedianFilter(size=3)),
        "sharpen": lambda im: im.filter(ImageFilter.SHARPEN),
        "blur": lambda im: im.filter(ImageFilter.GaussianBlur(radius=_float_params(params, "radius", 2))),
    }
    if preset not in presets:
        raise ValueError(f"unknown filter preset: {preset}")

    result = presets[preset](img.convert("RGB"))
    if alpha is not None:
        result.putalpha(alpha)
    return save_result(result, user_id, image_id, "filter")


def blur(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    radius = max(0.0, _float_params(params, "radius", 2))
    result = img.convert("RGBA" if alpha is not None else "RGB").filter(
        ImageFilter.GaussianBlur(radius=radius)
    )
    return save_result(result, user_id, image_id, "blur")


def sharpen(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    bgr = _bgr_from(img)
    amount = max(0.0, _float_params(params, "amount", 1.0))
    blur = cv2.GaussianBlur(bgr, (0, 0), 3) if amount >= 0 else bgr
    sharpened = cv2.addWeighted(bgr, 1 + amount, blur, -amount, 0)
    return save_result(_to_pil(sharpened, alpha), user_id, image_id, "sharpen")


def _split_alpha(img: Image.Image):
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    return alpha


def brightness_contrast(image_id: str, user_id: str, params: dict) -> str:
    """سطوع/تباين دقيق عبر convertScaleAbs: alpha=1+c/100, beta=b."""
    img = _load(image_id, user_id)
    alpha = _split_alpha(img)
    b = max(-100.0, min(100.0, _float_params(params, "brightness", 0)))
    c = max(-100.0, min(100.0, _float_params(params, "contrast", 0)))
    bgr = _bgr_from(img)
    result = cv2.convertScaleAbs(bgr, alpha=1.0 + c / 100.0, beta=b)
    return save_result(_to_pil(result, alpha), user_id, image_id, "brightness_contrast")


def hue_saturation(image_id: str, user_id: str, params: dict) -> str:
    """إزاحة Hue (-180..180) مع التفاف + تحجيم Saturation بالنسبة."""
    img = _load(image_id, user_id)
    alpha = _split_alpha(img)
    hue = max(-180.0, min(180.0, _float_params(params, "hue", 0)))
    sat = max(-100.0, min(100.0, _float_params(params, "saturation", 0)))
    bgr = _bgr_from(img)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 0] = (hsv[:, :, 0] + hue / 2.0) % 180.0
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (1.0 + sat / 100.0), 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    return save_result(_to_pil(out, alpha), user_id, image_id, "hue_saturation")


def grayscale(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    alpha = _split_alpha(img)
    gray = cv2.cvtColor(_bgr_from(img), cv2.COLOR_BGR2GRAY)
    bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    return save_result(_to_pil(bgr, alpha), user_id, image_id, "grayscale")


def sepia(image_id: str, user_id: str, params: dict) -> str:
    img = _load(image_id, user_id)
    alpha = _split_alpha(img)
    rgb = np.array(img.convert("RGB"), dtype=np.float32)
    kernel = np.array(
        [[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]],
        dtype=np.float32,
    )
    out = np.clip(cv2.transform(rgb, kernel), 0, 255).astype(np.uint8)
    return save_result(Image.fromarray(out, "RGB"), user_id, image_id, "sepia")


def vignette(image_id: str, user_id: str, params: dict) -> str:
    """تظليل حواف بقناع Gaussian حقيقي (0..100)."""
    img = _load(image_id, user_id)
    alpha = _split_alpha(img)
    strength = max(0.0, min(100.0, _float_params(params, "strength", 45)))
    bgr = _bgr_from(img).astype(np.float32)
    h, w = bgr.shape[:2]
    kw = max(w, 3) | 1  # فردي إجباري لـ getGaussianKernel
    kh = max(h, 3) | 1
    kx = cv2.getGaussianKernel(kw, w / 3.0)
    ky = cv2.getGaussianKernel(kh, h / 3.0)
    mask = (ky @ kx.T).astype(np.float32)
    mask = (mask - mask.min()) / max(mask.max() - mask.min(), 1e-6)
    k = strength / 100.0
    mask = (1.0 - k) + k * mask
    out = np.clip(bgr * mask[:, :, None], 0, 255).astype(np.uint8)
    return save_result(_to_pil(out, alpha), user_id, image_id, "vignette")


def upscale(image_id: str, user_id: str, params: dict) -> str:
    """تكبير عالي الجودة Lanczos4 بمقياس 2x/4x مع سقف حد البكسلات."""
    from ..config import get_settings

    img = _load(image_id, user_id)
    try:
        scale = int(params.get("scale", 2))
    except (TypeError, ValueError):
        scale = 2
    scale = 2 if scale not in (2, 4) else scale
    limit = int(get_settings().max_image_pixels)
    while scale > 2 and img.width * scale * img.height * scale > limit:
        scale = 2
    if img.width * scale * img.height * scale > limit:
        raise ValueError("upscaled image would exceed pixel limit")
    alpha = _split_alpha(img)
    bgr = _bgr_from(img)
    nw, nh = img.width * scale, img.height * scale
    big = cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
    if alpha is not None:
        a = np.array(alpha, dtype=np.uint8)
        big_a = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
        out = _to_pil(big, None)
        out.putalpha(Image.fromarray(big_a, "L"))
    else:
        out = _to_pil(big, None)
    return save_result(out, user_id, image_id, "upscale")


def inpaint(image_id: str, user_id: str, params: dict) -> str:
    """إزالة كائن عالية الدقة: توسيع القناع + NS/TELEA + دمج حواف مضاد للتشوه.

    params: mask (base64 إجباري), method: ns|telea|auto (الافتراضي ns — أدق للأنسجة),
            dilate: توسيع البكسلات (0..15, افتراضي 5 — يزيل هالة الحواف),
            radius: نصف قطر Inpaint (1..15, افتراضي 7),
            feather: تنعيم حد الدمج (0..10, افتراضي 2).
    """
    img = _load(image_id, user_id)
    mask = _decode_mask(params.get("mask"))
    if mask.size != img.size:
        mask = mask.resize(img.size, Image.Resampling.NEAREST)

    bgr = _bgr_from(img)
    mask_array = np.array(mask.convert("L"), dtype=np.uint8)
    _, mask_bin = cv2.threshold(mask_array, 127, 255, cv2.THRESH_BINARY)
    if int((mask_bin > 0).sum()) == 0:
        raise ValueError("mask is empty — paint over the object first")

    dilate = max(0, min(15, _int_param(params, "dilate", 5)))
    radius = max(1.0, min(15.0, float(params.get("radius", 7) if isinstance(params.get("radius", 7), (int, float)) else 7)))
    feather = max(0, min(10, _int_param(params, "feather", 2)))
    method = str(params.get("method", "ns")).lower()

    # توسيع القناع لابتلاع هالة حواف الكائن + إغلاق الثقوب الصغيرة
    if dilate > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate * 2 + 1, dilate * 2 + 1))
        mask_bin = cv2.dilate(mask_bin, k, iterations=1)
    mask_bin = cv2.morphologyEx(mask_bin, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    def run(m: np.ndarray, flag: int) -> np.ndarray:
        return cv2.inpaint(bgr, m, radius, flag)

    if method == "telea":
        result = run(mask_bin, cv2.INPAINT_TELEA)
    elif method == "auto":
        # الأفضل تلقائياً: NS للأنسجة + TELEA للمناطق الملساء — ندمجهما بقناع تفاصيل
        r_ns = run(mask_bin, cv2.INPAINT_NS)
        r_te = run(mask_bin, cv2.INPAINT_TELEA)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        detail = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
        detail = cv2.GaussianBlur(np.abs(detail), (0, 0), 3)
        w = np.clip(detail / (detail.mean() + 12.0), 0, 1).astype(np.float32)[:, :, None]
        result = (r_ns.astype(np.float32) * w + r_te.astype(np.float32) * (1 - w)).astype(np.uint8)
    else:  # ns — الافتراضي: يحافظ على النسيج أدق من TELEA ويشوّه أقل
        result = run(mask_bin, cv2.INPAINT_NS)

    # دمج حواف ناعم: يمنع حلقة الضباب حول المنطقة المعالجة (سبب التشوه المرئي)
    if feather > 0:
        ksize = max(3, (feather * 2 + 1) | 1)
        soft = cv2.GaussianBlur((mask_bin > 0).astype(np.float32), (ksize, ksize), 0)[:, :, None]
        # تآكل طفيف للقناع الناعم حتى لا يتسرب الأصل فوق الحواف
        inner = cv2.erode((mask_bin > 0).astype(np.uint8) * 255, np.ones((3, 3), np.uint8))
        inner = cv2.GaussianBlur(inner.astype(np.float32) / 255.0, (ksize, ksize), 0)[:, :, None]
        w = np.clip(soft, 0, 1) * 0.5 + np.clip(inner, 0, 1) * 0.5
        result = (result.astype(np.float32) * w + bgr.astype(np.float32) * (1 - w)).astype(np.uint8)
        # إعادة المنطقة الداخلية الصرفة من نتيجة الـinpaint (دون مزج)
        core = cv2.erode((mask_bin > 0).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=max(1, feather)) > 0
        result[core] = cv2.inpaint(bgr, mask_bin, radius, cv2.INPAINT_NS if method != "telea" else cv2.INPAINT_TELEA)[core]

    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    return save_result(_to_pil(result, alpha), user_id, image_id, "inpaint")


def _decode_mask(value: object) -> Image.Image:
    if isinstance(value, str):
        data = value
        if data.startswith("data:"):
            data = data.split(",", 1)[1]
        try:
            raw = base64.b64decode(data, validate=True)
            return Image.open(io.BytesIO(raw)).convert("L")
        except Exception as exc:
            raise ValueError("invalid mask encoding") from exc
    raise ValueError("params.mask must be a base64 PNG string")