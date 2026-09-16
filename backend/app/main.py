from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import process_pool
from .api import routes_compare, routes_health, routes_images, routes_operations, routes_projects
from .config import get_settings
from .db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    process_pool.start_pool()
    yield
    process_pool.stop_pool()


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)


@app.get("/")
def root() -> dict:
    return {
        "app": settings.app_name,
        "health": "/api/health",
        "docs": "/docs",
        "upload": "POST /api/images/upload",
        "operations": "POST /api/operations/{name}",
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=getattr(settings, "cors_origin_regex", r"https?://(localhost|127\.0\.0\.1)(:\d+)?"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Type"],
)

API_PREFIX = "/api"
app.include_router(routes_health.router, prefix=API_PREFIX)
app.include_router(routes_images.router, prefix=API_PREFIX)
app.include_router(routes_images.static_router, prefix=API_PREFIX)
app.include_router(routes_operations.router, prefix=API_PREFIX)
app.include_router(routes_compare.router, prefix=API_PREFIX)
app.include_router(routes_projects.router, prefix=API_PREFIX)