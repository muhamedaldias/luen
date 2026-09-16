import os
import tempfile
from pathlib import Path

_root = Path(tempfile.mkdtemp(prefix="lumen-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_root.as_posix()}/test.db"
os.environ["STORAGE_ROOT"] = str(_root / "storage")
os.environ["MAX_FILE_SIZE_MB"] = "1"

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def inline_pool(monkeypatch):
    async def fake_run(fn, *args, **kwargs):
        return fn(*args, **kwargs)

    monkeypatch.setattr("app.process_pool.run_in_pool", fake_run)
    monkeypatch.setattr("app.process_pool.submit", lambda *args, **kwargs: None)


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


def make_png_bytes(size: tuple[int, int] = (64, 48)) -> bytes:
    from io import BytesIO

    from PIL import Image

    img = Image.new("RGBA", size, (200, 120, 40, 255))
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()