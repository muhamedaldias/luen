from typing import Any, Literal

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    image_id: str
    url: str
    width: int
    height: int
    size_bytes: int
    mime: str


class OperationRequest(BaseModel):
    image_id: str = Field(min_length=1)
    params: dict[str, Any] = Field(default_factory=dict)


class OperationDone(BaseModel):
    status: Literal["done"] = "done"
    result_url: str


class OperationAccepted(BaseModel):
    status: Literal["processing"] = "processing"
    job_id: str


class JobStatusResponse(BaseModel):
    status: Literal["processing", "done", "error"]
    result_url: str | None = None
    error: str | None = None


class CompareEngineResult(BaseModel):
    engine: str
    status: Literal["done", "error"]
    result_url: str | None = None
    error: str | None = None


class CompareResponse(BaseModel):
    image_id: str
    results: list[CompareEngineResult]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectOut(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ImageOut(BaseModel):
    id: str
    project_id: str | None
    original_name: str
    width: int
    height: int
    size_bytes: int
    mime: str
    created_at: str

    model_config = {"from_attributes": True}