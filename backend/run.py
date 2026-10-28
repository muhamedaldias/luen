"""Backend entry point — runs locally and after PyInstaller packaging.

`lumen.spec` pointed at this file, but it was missing, so packaging silently
fell back to `app/main.py`, which never calls `uvicorn.run` — and the
executable exited immediately.
"""
import os

import uvicorn

from app.main import app

if __name__ == "__main__":
    host = os.environ.get("LUMEN_HOST", "127.0.0.1")
    port = int(os.environ.get("LUMEN_PORT", "8000"))
    log_level = os.environ.get("LUMEN_LOG_LEVEL", "info")
    uvicorn.run(app, host=host, port=port, log_level=log_level)