import re

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .. import storage
from ..config import get_settings
from ..db import SessionLocal
from ..models import ImageRecord
from ..schemas import UploadResponse
from ..security.upload import UploadError, validate_uploaded_image
from ..storage import as_url, original_path

router = APIRouter(prefix="/images", tags=["images"])
static_router = APIRouter(tags=["static"])

FILENAME_RE = re.compile(r"^[a-z0-9_-]+\.png$")
IMAGE_ID_RE = re.compile(r"^[0-9a-f]{32}$")
USER_ID_RE = re.compile(r"^[a-z0-9_-]{1,64}$")


def _resolve_storage_file(user_id: str, image_id: str, filename: str):
    """مسار آمن بدون إنشاء مجلدات + حصر داخل storage_root (منع traversal)."""
    settings = get_settings()
    root = settings.storage_root.resolve()
    candidate = (root / user_id / image_id / filename).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        from fastapi import HTTPException as _HE

        raise _HE(status_code=400, detail="invalid path") from None
    return candidate


@router.post("/upload", response_model=UploadResponse)
async def upload_image(file: UploadFile) -> UploadResponse:
    user_id = get_settings().default_user_id
    raw = await file.read()
    try:
        image, mime = validate_uploaded_image(raw)
    except UploadError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    import uuid as _uuid

    from ..security.upload import make_preview

    image_id = _uuid.uuid4().hex
    path = original_path(user_id, image_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")

    # فصل دقة العرض: الأصل الكامل للمعالجة/التصدير + نسخة preview capped للعرض السريع.
    try:
        preview = make_preview(image, get_settings().preview_max_side)
        preview.save(path.parent / "preview.png", format="PNG")
    except Exception:
        pass

    with SessionLocal() as db:
        record = ImageRecord(
            id=image_id,
            user_id=user_id,
            original_name=file.filename or f"{image_id}.png",
            mime=mime,
            width=image.width,
            height=image.height,
            size_bytes=len(raw),
        )
        db.add(record)
        db.commit()

    return UploadResponse(
        image_id=image_id,
        url=as_url(user_id, image_id, "original.png"),
        width=image.width,
        height=image.height,
        size_bytes=len(raw),
        mime=mime,
    )


@static_router.get("/storage/{user_id}/{image_id}/{filename}")
def serve_storage(user_id: str, image_id: str, filename: str):
    # تطبيق single-user محلي: أي user_id لا يطابق الافتراضي يُرفض بـ 404 (لا تسريب وجود).
    settings = get_settings()
    if (
        not USER_ID_RE.fullmatch(user_id)
        or not IMAGE_ID_RE.fullmatch(image_id)
        or not FILENAME_RE.fullmatch(filename)
    ):
        raise HTTPException(status_code=400, detail="invalid path")
    if user_id != settings.default_user_id:
        raise HTTPException(status_code=404, detail="file not found")
    path = _resolve_storage_file(user_id, image_id, filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    # رؤوس CORS صريحة للصور: تسمح بتحميلها في <canvas> عبر crossOrigin="anonymous"
    # دون تلوّث (taint) — حتى لو فُتحت الواجهة من origin مختلف (Tauri/preview).
    return FileResponse(
        str(path),
        media_type="image/png",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cross-Origin-Resource-Policy": "cross-origin",
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/{image_id}")
def get_image(image_id: str) -> dict:
    user_id = get_settings().default_user_id
    with SessionLocal() as db:
        record = db.get(ImageRecord, image_id)
        if record is None or record.user_id != user_id:
            raise HTTPException(status_code=404, detail="image not found")
        return {
            "image_id": record.id,
            "original_name": record.original_name,
            "width": record.width,
            "height": record.height,
            "mime": record.mime,
            "created_at": record.created_at.isoformat(),
        }


@router.delete("/{image_id}", status_code=204)
def delete_image(image_id: str) -> None:
    user_id = get_settings().default_user_id
    with SessionLocal() as db:
        record = db.get(ImageRecord, image_id)
        if record is None or record.user_id != user_id:
            raise HTTPException(status_code=404, detail="image not found")
        db.delete(record)
        db.commit()
    storage.delete_image_dir(user_id, image_id)