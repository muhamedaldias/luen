import asyncio
from concurrent.futures import ProcessPoolExecutor
from typing import Any

from .config import get_settings

_pool: ProcessPoolExecutor | None = None


def start_pool() -> None:
    global _pool
    if _pool is None:
        _pool = ProcessPoolExecutor(max_workers=get_settings().pool_workers)


def stop_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.shutdown(wait=False)
        _pool = None


async def run_in_pool(fn: Any, *args: Any, **kwargs: Any) -> Any:
    global _pool
    if _pool is None:
        start_pool()
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_pool, fn, *args, **kwargs)


def submit(fn: Any, *args: Any) -> Any:
    global _pool
    if _pool is None:
        start_pool()
    return _pool.submit(fn, *args)