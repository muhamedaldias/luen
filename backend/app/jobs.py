import asyncio
import time
import uuid

from .config import get_settings


class JobStore:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._jobs: dict[str, dict] = {}
        self._created: dict[str, float] = {}

    async def create(self) -> str:
        job_id = uuid.uuid4().hex
        async with self._lock:
            self._jobs[job_id] = {"status": "processing"}
            self._created[job_id] = time.monotonic()
        return job_id

    async def finish(self, job_id: str, result_url: str | None = None, error: str | None = None) -> None:
        async with self._lock:
            if job_id not in self._jobs:
                return
            if error is not None:
                self._jobs[job_id] = {"status": "error", "error": error}
            else:
                self._jobs[job_id] = {"status": "done", "result_url": result_url}

    async def get(self, job_id: str) -> dict | None:
        async with self._lock:
            self._expire_locked()
            return self._jobs.get(job_id)

    async def _expire_locked(self) -> None:
        ttl = get_settings().job_ttl_seconds
        now = time.monotonic()
        stale = [j for j, t in self._created.items() if now - t > ttl]
        for job_id in stale:
            self._jobs.pop(job_id, None)
            self._created.pop(job_id, None)


job_store = JobStore()