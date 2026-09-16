import shutil
from pathlib import Path

from .config import get_settings


def user_dir(user_id: str) -> Path:
    settings = get_settings()
    path = settings.storage_root / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def image_dir(user_id: str, image_id: str) -> Path:
    path = user_dir(user_id) / image_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def original_path(user_id: str, image_id: str, extension: str = ".png") -> Path:
    return image_dir(user_id, image_id) / f"original{extension}"


def result_path(user_id: str, image_id: str, operation: str) -> Path:
    return image_dir(user_id, image_id) / f"{operation}.png"


def delete_image_dir(user_id: str, image_id: str) -> None:
    path = user_dir(user_id) / image_id
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


def as_url(user_id: str, image_id: str, filename: str) -> str:
    return f"/api/storage/{user_id}/{image_id}/{filename}"