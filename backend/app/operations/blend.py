"""دمج صورتين بأدق خوارزميات OpenCV — جودة قصوى.

الخلفية: الصورة الحالية (image_id). الأمامية: إما image_id ثانٍ (foreground_id)
أو base64/dataURL (foreground). كل المعالجة float32 وتحافظ على Alpha.
"""

import base64
import io

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None

from PIL import Image

from . import save_result
from .classical import _bgr_from, _load, _to_pil


def _decode_foreground(value: object) -> Image.Image:
    if not isinstance(value, str) or not value:
        raise ValueError("params.foreground (base64 PNG) or foreground_id is required")
    data = value
    if data.startswith("data:"):
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data, validate=False)
        return Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception as exc:
        raise ValueError("invalid foreground encoding") from exc


def _load_foreground(user_id: str, params: dict) -> Image.Image:
    fid = params.get("foreground_id")
    if isinstance(fid, str) and fid:
        from . import validate_image_id

        validate_image_id(fid)
        return _load(fid, user_id).convert("RGBA")
    return _decode_foreground(params.get("foreground"))


def _num(params: dict, key: str, default: float) -> float:
    try:
        v = float(params.get(key, default))
    except (TypeError, ValueError):
        return default
    return v


def _reinhard_match(src_bgr: np.ndarray, ref_bgr: np.ndarray, strength: float = 1.0) -> np.ndarray:
    """مطابقة لون Reinhard في LAB: تنقل mean/std من المرجع — تقلل فرق الإضاءة قبل الدمج."""
    try:
        src_lab = cv2.cvtColor(src_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        ref_lab = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    except Exception:
        return src_bgr
    out = np.empty_like(src_lab)
    for i in range(3):
        s_mean, s_std = float(src_lab[:, :, i].mean()), float(src_lab[:, :, i].std())
        r_mean, r_std = float(ref_lab[:, :, i].mean()), float(ref_lab[:, :, i].std())
        if s_std < 1e-3:
            out[:, :, i] = src_lab[:, :, i]
        else:
            mapped = (src_lab[:, :, i] - s_mean) * (r_std / max(s_std, 1e-3)) + r_mean
            out[:, :, i] = src_lab[:, :, i] * (1.0 - strength) + mapped * strength
    out = np.clip(out, 0, 255).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2BGR)


def _feather_mask(h: int, w: int, feather: int) -> np.ndarray:
    """قناع أبيض كامل بحواف مُنعّمة (للـ pyramid/feather)."""
    mask = np.ones((h, w), dtype=np.float32)
    f = int(max(0, min(120, feather)))
    if f <= 0:
        return (mask * 255).astype(np.uint8)
    # تآكل داخلي ثم Gaussian لإنشاء تدرج ناعم فقط على الحواف
    k = max(3, (f * 2 + 1) | 1)
    eroded = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=min(f, 12))
    soft = cv2.GaussianBlur(eroded, (k, k), 0)
    return (np.clip(soft, 0, 1) * 255).astype(np.uint8)


def _pyramid_blend(bg: np.ndarray, fg: np.ndarray, mask01: np.ndarray, levels: int = 5) -> np.ndarray:
    """دمج هرم لابلاس متعدد النطاقات (Burt & Adelson): يزيل خط الفاصل تماماً."""
    h, w = bg.shape[:2]
    levels = max(2, min(6, levels))
    # هرم غاوسي للقناع
    gp_mask = [mask01.astype(np.float32)]
    cur = mask01.astype(np.float32)
    for _ in range(levels - 1):
        cur = cv2.pyrDown(cur)
        gp_mask.append(cur)
    # هرم لابلاس للصورتين
    def lap_pyr(img: np.ndarray) -> list:
        gp = [img.astype(np.float32)]
        c = img.astype(np.float32)
        for _ in range(levels - 1):
            c = cv2.pyrDown(c)
            gp.append(c)
        lp = []
        for i in range(levels - 1):
            up = cv2.pyrUp(gp[i + 1], dstsize=(gp[i].shape[1], gp[i].shape[0]))
            lp.append(gp[i] - up)
        lp.append(gp[-1])
        return lp

    lp_bg, lp_fg = lap_pyr(bg), lap_pyr(fg)
    blended: list = []
    for i in range(levels):
        m = gp_mask[i]
        if m.shape[:2] != lp_bg[i].shape[:2]:
            m = cv2.resize(m, (lp_bg[i].shape[1], lp_bg[i].shape[0]), interpolation=cv2.INTER_LINEAR)
        m3 = m[:, :, None]
        blended.append(lp_bg[i] * (1.0 - m3) + lp_fg[i] * m3)
    out = blended[-1]
    for i in range(levels - 2, -1, -1):
        out = cv2.pyrUp(out, dstsize=(blended[i].shape[1], blended[i].shape[0])) + blended[i]
    return np.clip(out, 0, 255).astype(np.uint8)


def blend(image_id: str, user_id: str, params: dict) -> str:
    if cv2 is None:
        raise RuntimeError("opencv is required for blending")
    bg_img = _load(image_id, user_id).convert("RGBA")
    fg_img = _load_foreground(user_id, params).convert("RGBA")

    bg_a = np.array(bg_img)[:, :, 3]
    bw, bh = bg_img.size
    mode = str(params.get("mode", "seamless_normal")).lower()
    scale_pct = max(5.0, min(100.0, _num(params, "scale", 40)))
    cx_pct = max(0.0, min(100.0, _num(params, "x", 50)))
    cy_pct = max(0.0, min(100.0, _num(params, "y", 50)))
    feather = int(max(0, min(80, _num(params, "feather", 12))))
    color_match = str(params.get("color_match", "1")).lower() not in ("0", "false", "no")

    # تحجيم الأمامية كنسبة من عرض الخلفية مع الحفاظ على النسبة
    target_w = max(8, int(bw * scale_pct / 100.0))
    ratio = target_w / max(1, fg_img.width)
    target_h = max(8, int(fg_img.height * ratio))
    interp = cv2.INTER_AREA if ratio < 1.0 else cv2.INTER_LANCZOS4
    fg_small = fg_img.resize((target_w, target_h), Image.LANCZOS if ratio >= 1.0 else Image.BILINEAR)
    fg_arr = np.array(fg_small)
    fg_rgb = fg_arr[:, :, :3]
    fg_alpha = fg_arr[:, :, 3]
    fg_bgr = cv2.cvtColor(fg_rgb, cv2.COLOR_RGB2BGR)

    bg_bgr = _bgr_from(bg_img)

    # موضع المركز (نسبة مئوية من الخلفية) مع تقييد داخل الحدود
    cx = int(bw * cx_pct / 100.0)
    cy = int(bh * cy_pct / 100.0)
    fh, fw = fg_bgr.shape[:2]
    x0 = max(0, min(bw - fw, cx - fw // 2))
    y0 = max(0, min(bh - fh, cy - fh // 2))
    center = (x0 + fw // 2, y0 + fh // 2)

    # مطابقة لون اختيارية لمنطقة الخلفية المستهدفة (تحسّن Poisson كثيراً)
    if color_match:
        x1, y1 = max(0, x0), max(0, y0)
        x2, y2 = min(bw, x0 + fw), min(bh, y0 + fh)
        if x2 > x1 and y2 > y1:
            ref = bg_bgr[y1:y2, x1:x2]
            if ref.shape[:2] == fg_bgr.shape[:2]:
                fg_bgr = _reinhard_match(fg_bgr, ref, strength=0.65)

    # قناع من ألفا الأمامية (إن وجدت) وإلا مستطيل كامل — مع تنعيم الحواف
    if fg_alpha.mean() < 250:
        base_mask = fg_alpha
    else:
        base_mask = np.full((fh, fw), 255, dtype=np.uint8)
    if feather > 0:
        k = max(3, (min(feather, 60) * 2 + 1) | 1)
        base_mask = cv2.GaussianBlur(base_mask, (k, k), 0)

    if mode in ("seamless_normal", "seamless_mixed", "seamless_mono", "normal", "mixed", "mono"):
        flag = cv2.NORMAL_CLONE
        if mode in ("seamless_mixed", "mixed"):
            flag = cv2.MIXED_CLONE
        elif mode in ("seamless_mono", "mono"):
            flag = cv2.MONOCHROME_TRANSFER
        _, mask_bin = cv2.threshold(base_mask, 1, 255, cv2.THRESH_BINARY)
        try:
            out = cv2.seamlessClone(fg_bgr, bg_bgr, mask_bin, center, flag)
        except Exception as exc:
            raise ValueError(f"seamlessClone failed (foreground may exceed background): {exc}") from exc
    elif mode == "pyramid":
        canvas = bg_bgr.copy()
        x1, y1 = x0, y0
        x2, y2 = x0 + fw, y0 + fh
        roi_bg = canvas[y1:y2, x1:x2]
        m01 = (base_mask.astype(np.float32) / 255.0)
        # إن كانت الأمامية شفافة جزئياً ندمج ألفاها مع القناع
        blended_roi = _pyramid_blend(roi_bg, fg_bgr, m01, levels=5)
        canvas[y1:y2, x1:x2] = blended_roi
        out = canvas
    else:  # feather — مزج ألفا ناعم كلاسيكي عالي الجودة
        canvas = bg_bgr.astype(np.float32)
        alpha = (base_mask.astype(np.float32) / 255.0)[:, :, None]
        x1, y1 = x0, y0
        x2, y2 = x0 + fw, y0 + fh
        canvas[y1:y2, x1:x2] = canvas[y1:y2, x1:x2] * (1 - alpha) + fg_bgr.astype(np.float32) * alpha
        out = np.clip(canvas, 0, 255).astype(np.uint8)

    result = _to_pil(out, Image.fromarray(bg_a, "L"))
    return save_result(result, user_id, image_id, "blend")
