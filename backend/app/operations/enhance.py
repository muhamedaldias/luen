"""تحسين احترافي بزر واحد: خط أنابيب متكامل بأعلى جودة ممكنة كلاسيكياً.

الترتيب (مهم — كل خطوة تهيئ التالية):
1) إزالة ضجيج لونية خفيفة تحافظ على الحواف (fastNlMeans)
2) توازن أبيض Gray-World مدمج جزئياً (يزيل الاصفرار/الازرقاق)
3) CLAHE على قناة L في LAB (تباين محلي دون حرق الإضاءات)
4) حيوية انتقائية (تشبع للألوان الباهتة فقط — يحمي البشرة)
5) حدة Unsharp Mask تكيفية + حماية الهالات
كل المعالجة float32، وتُحفظ Alpha كما هي.
"""

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None

from PIL import Image

from . import save_result
from .classical import _bgr_from, _float_params, _load, _to_pil


def _gray_world(bgr: np.ndarray, strength: float) -> np.ndarray:
    f = bgr.astype(np.float32)
    means = f.reshape(-1, 3).mean(axis=0)
    gray = float(means.mean())
    if gray < 1e-3:
        return bgr
    gains = gray / np.maximum(means, 1e-3)
    gains = 1.0 + (gains - 1.0) * strength
    gains = np.clip(gains, 0.85, 1.18)  # كبح آمن ضد الانحراف اللوني
    return np.clip(f * gains[None, None, :], 0, 255).astype(np.uint8)


def _vibrance(bgr: np.ndarray, amount: float) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    s = hsv[:, :, 1] / 255.0
    # الأقل تشبعاً يأخذ تعزيزاً أكبر (يحمي البشرة المشبعة أصلاً)
    boost = (1.0 - s) * amount
    hsv[:, :, 1] = np.clip((s * (1.0 + boost)) * 255.0, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def pro_enhance(image_id: str, user_id: str, params: dict) -> str:
    if cv2 is None:
        raise RuntimeError("opencv is required for pro_enhance")
    img = _load(image_id, user_id)
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    strength = max(0.0, min(100.0, _float_params(params, "strength", 70)))
    k = strength / 100.0

    bgr = _bgr_from(img)

    # 1) إزالة ضجيج خفيفة (تتناسب مع القوة — لا بلاستيكية)
    if k > 0.05:
        h = 3.0 + 5.0 * k
        try:
            bgr = cv2.fastNlMeansDenoisingColored(bgr, None, h=h, hColor=h, templateWindowSize=7, searchWindowSize=21)
        except Exception:
            bgr = cv2.bilateralFilter(bgr, 5, 50, 50)

    # 2) توازن أبيض
    if k > 0.05:
        bgr = _gray_world(bgr, strength=0.25 + 0.55 * k)

    # 3) CLAHE محلي على L فقط (لا يمس اللون)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clip = 1.4 + 1.8 * k
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
    l = clahe.apply(l)
    # تمديد لطيف إضافي للظلال/الإضاءات بنسبة صغيرة
    if k > 0.3:
        l = cv2.convertScaleAbs(l, alpha=1.0 + 0.06 * k, beta=-2.0 * k)
    lab = cv2.merge((l, a, b))
    bgr = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 4) حيوية انتقائية
    if k > 0.05:
        bgr = _vibrance(bgr, amount=0.15 + 0.45 * k)

    # 5) حدة تكيفية: Unsharp حقيقي (صورة − ضبابية) مع كبح الهالات
    if k > 0.05:
        sigma = 1.2 + 1.3 * k
        amount = 0.35 + 0.85 * k
        blur = cv2.GaussianBlur(bgr, (0, 0), sigma)
        sharp = cv2.addWeighted(bgr, 1.0 + amount, blur, -amount, 0)
        # مزج الحدة فقط حيث التفاصيل (قناع Laplacian) لتفادي تضخيم ضجيج السماء
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
        detail = np.clip(np.abs(lap) / 24.0, 0, 1).astype(np.float32)
        detail = cv2.GaussianBlur(detail, (0, 0), 2.0)
        d3 = detail[:, :, None]
        out = bgr.astype(np.float32) * (1 - d3 * 0.85) + sharp.astype(np.float32) * (d3 * 0.85)
        bgr = np.clip(out, 0, 255).astype(np.uint8)

    return save_result(_to_pil(bgr, alpha), user_id, image_id, "pro_enhance")
