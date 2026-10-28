import io

from PIL import Image

from ..config import get_settings

ALLOWED_MIMES = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/tiff"}


class UploadError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def validate_uploaded_image(file_bytes: bytes) -> tuple[Image.Image, str]:
    settings = get_settings()

    # Enable the pixel limit before any Image.open call (decompression-bomb protection).
    try:
        Image.MAX_IMAGE_PIXELS = int(settings.max_image_pixels)
    except Exception:
        pass

    if len(file_bytes) > settings.max_file_size_mb * 1024 * 1024:
        raise UploadError(413, f"file size exceeds the allowed limit ({settings.max_file_size_mb} MB)")

    try:
        probe = Image.open(io.BytesIO(file_bytes))
        probe.verify()
    except Image.DecompressionBombError as exc:
        raise UploadError(413, "image is too large (exceeded the allowed pixel limit)") from exc
    except Exception as exc:
        raise UploadError(400, "file is not a valid image") from exc

    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.load()
    except Image.DecompressionBombError as exc:
        raise UploadError(413, "image is too large (exceeded the allowed pixel limit)") from exc
    except Exception as exc:
        raise UploadError(400, "file is not a valid image") from exc

    if img.width > settings.max_dimension or img.height > settings.max_dimension:
        raise UploadError(400, f"dimensions exceed the maximum of {settings.max_dimension}x{settings.max_dimension}")

    # Check the actual pixel count (width x height) — dimensions alone are not enough.
    try:
        pixels = int(img.width) * int(img.height)
    except Exception:
        pixels = 0
    if pixels > int(settings.max_image_pixels):
        raise UploadError(413, "image is too large (exceeded the allowed pixel limit)")

    fmt = (img.format or "PNG").lower()
    mime = {"jpeg": "image/jpeg"}.get(fmt, f"image/{fmt}")
    return img, mime


def make_preview(img: Image.Image, max_side: int) -> Image.Image:
    """Preview copy capped at preview_max_side — the full-resolution original is kept for processing and export."""
    out = img.copy()
    try:
        side = max(out.width, out.height)
        if side > max_side and side > 0:
            ratio = max_side / float(side)
            nw = max(1, int(out.width * ratio))
            nh = max(1, int(out.height * ratio))
            out.thumbnail((nw, nh), Image.LANCZOS)
    except Exception:
        pass
    return out