import numpy as np

from PIL import Image, ImageFilter

from . import save_result
from .classical import _load


_SESSION = None
_REMBG_AVAILABLE = None


def _is_rembg_available() -> bool:
    global _REMBG_AVAILABLE
    if _REMBG_AVAILABLE is None:
        try:
            import rembg  # noqa: F401
            _REMBG_AVAILABLE = True
        except ImportError:
            _REMBG_AVAILABLE = False
    return _REMBG_AVAILABLE


def _get_session():
    global _SESSION
    if _SESSION is None:
        if not _is_rembg_available():
            raise RuntimeError(
                "rembg not installed. Install with: pip install rembg"
            )
        from rembg import new_session

        model = "isnet-general-use"
        try:
            _SESSION = new_session(model)
        except Exception:
            _SESSION = new_session("u2net")
    return _SESSION


def remove_background(image_id: str, user_id: str, params: dict) -> str:
    """إزالة خلفية: rembg (إن ثُبّت لاحقاً) وإلا GrabCut من OpenCV — يعمل الآن."""
    if _is_rembg_available():
        try:
            return _rembg_path(image_id, user_id)
        except Exception:
            pass  # تراجع تلقائي إلى OpenCV
    return _grabcut_path(image_id, user_id)


def _rembg_path(image_id: str, user_id: str) -> str:
    img = _load(image_id, user_id).convert("RGBA")
    session = _get_session()

    from rembg import remove

    result = remove(img, session=session, post_process_mask=True)
    result = _clean_mask_edges(result)
    return save_result(result, user_id, image_id, "remove_background")


def _grabcut_path(image_id: str, user_id: str) -> str:
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("opencv is required for background removal") from exc

    img = _load(image_id, user_id).convert("RGBA")
    orig_alpha = np.array(img)[:, :, 3]
    rgb = np.array(img.convert("RGB"))
    h, w = rgb.shape[:2]
    if min(h, w) < 8:
        raise ValueError("image too small for background removal")

    # عمل مصغّر للسرعة (أطول ضلع 800) ثم إعادة القناع للأصل
    scale = min(1.0, 800.0 / max(h, w))
    small = rgb if scale >= 1.0 else cv2.resize(rgb, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
    sh, sw = small.shape[:2]

    mask = np.full((sh, sw), cv2.GC_PR_BGD, dtype=np.uint8)
    ix, iy = int(sw * 0.04), int(sh * 0.04)
    rect = (ix, iy, max(1, sw - 2 * ix), max(1, sh - 2 * iy))
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(small, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    except Exception as exc:
        raise RuntimeError(f"grabcut failed: {exc}") from exc

    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    ratio = float(fg.mean()) / 255.0
    if ratio < 0.02 or ratio > 0.98:
        # تراجع آمن: قطع ناقص مركزي بدل قناع منحل
        fg = np.zeros((sh, sw), np.uint8)
        cv2.ellipse(fg, (sw // 2, sh // 2), (int(sw * 0.38), int(sh * 0.38)), 0, 0, 360, 255, -1)

    if (sh, sw) != (h, w):
        fg = cv2.resize(fg, (w, h), interpolation=cv2.INTER_LINEAR)
        _, fg = cv2.threshold(fg, 127, 255, cv2.THRESH_BINARY)
    kernel = np.ones((3, 3), np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel, iterations=1)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, kernel, iterations=2)
    fg = cv2.GaussianBlur(fg, (5, 5), 0)  # تنعيم الحواف

    # دمج شفافية الأصل (إن وجدت) مع قناع المقدمة
    alpha = np.minimum(orig_alpha, fg).astype(np.uint8)
    out = np.array(img)
    out[:, :, 3] = alpha
    return save_result(Image.fromarray(out, "RGBA"), user_id, image_id, "remove_background")


def _clean_mask_edges(image: Image.Image) -> Image.Image:
    try:
        import cv2
    except ImportError:
        return image

    rgba = np.array(image)
    alpha = rgba[:, :, 3]
    kernel = np.ones((3, 3), np.uint8)
    opened = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel, iterations=1)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=1)
    rgba[:, :, 3] = closed
    return Image.fromarray(np.ascontiguousarray(rgba))