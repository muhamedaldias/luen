from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Lumen API"
    debug: bool = False

    host: str = "0.0.0.0"
    port: int = 8000

    database_url: str = "sqlite:///./lumen.db"

    storage_root: Path = Path("storage")

    max_file_size_mb: int = 15
    max_dimension: int = 8000
    max_image_pixels: int = 64_000_000

    pool_workers: int = 4
    preview_max_side: int = 4096

    job_ttl_seconds: int = 600

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8443", "http://127.0.0.1:5173", "http://127.0.0.1:8443"]
    cors_origin_regex: str = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
    default_user_id: str = "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_slow_operations() -> list[str]:
    slow = ["auto_enhance", "pro_enhance", "blend", "remove_object", "upscale", "denoise", "radial_blur"]
    try:
        import rembg  # noqa: F401
        slow.append("remove_background")
    except ImportError:
        pass
    return slow