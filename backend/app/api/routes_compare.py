import asyncio

from fastapi import APIRouter, HTTPException

from .. import process_pool
from ..config import get_settings
from ..operations.registry import get_comparison
from ..schemas import CompareEngineResult, CompareResponse, OperationRequest

router = APIRouter(prefix="/compare", tags=["compare"])


@router.post("/{operation_name}", response_model=CompareResponse)
async def compare_operation(operation_name: str, body: OperationRequest):
    engines = get_comparison(operation_name)
    if not engines:
        raise HTTPException(status_code=404, detail="لا توجد مقارنة مسجلة لهذه العملية")
    user_id = get_settings().default_user_id

    tasks = [
        process_pool.run_in_pool(engine["handler"], body.image_id, user_id, body.params)
        for engine in engines
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    out: list[CompareEngineResult] = []
    for engine, result in zip(engines, results):
        if isinstance(result, Exception):
            out.append(CompareEngineResult(engine=engine["engine"], status="error", error=str(result)))
        else:
            out.append(CompareEngineResult(engine=engine["engine"], status="done", result_url=result))
    return CompareResponse(image_id=body.image_id, results=out)