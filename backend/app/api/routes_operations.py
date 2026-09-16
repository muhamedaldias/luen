import asyncio

from fastapi import APIRouter, HTTPException

from .. import process_pool
from ..config import get_settings, get_slow_operations
from ..jobs import job_store
from ..operations.registry import get_operation
from ..schemas import OperationAccepted, OperationDone, OperationRequest

router = APIRouter(prefix="/operations", tags=["operations"])


@router.post("/{operation_name}", response_model=OperationDone | OperationAccepted)
async def run_operation(operation_name: str, body: OperationRequest):
    handler = get_operation(operation_name)
    if handler is None:
        raise HTTPException(status_code=404, detail=f"عملية غير معروفة: {operation_name}")
    user_id = get_settings().default_user_id

    slow_ops = get_settings().slow_operations if hasattr(get_settings(), 'slow_operations') else get_slow_operations()
    if operation_name in slow_ops:
        job_id = await job_store.create()
        loop = asyncio.get_running_loop()
        future = process_pool.submit(handler, body.image_id, user_id, body.params)

        async def finish(fut):
            try:
                result_url = fut.result()
            except Exception as exc:
                await job_store.finish(job_id, error=str(exc))
            else:
                await job_store.finish(job_id, result_url=result_url)

        future.add_done_callback(lambda fut: loop.create_task(finish(fut)))
        return OperationAccepted(job_id=job_id)

    try:
        result_url = await process_pool.run_in_pool(handler, body.image_id, user_id, body.params)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"operation failed: {exc}") from exc
    return OperationDone(result_url=result_url)


@router.get("/{job_id}/status")
async def job_status(job_id: str):
    job = await job_store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return {"status": job["status"], "result_url": job.get("result_url"), "error": job.get("error")}