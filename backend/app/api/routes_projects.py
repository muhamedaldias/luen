from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from .. import storage
from ..config import get_settings
from ..db import SessionLocal
from ..models import Project
from ..schemas import ImageOut, ProjectCreate, ProjectOut

router = APIRouter(prefix="/projects", tags=["projects"])


def _user_id() -> str:
    return get_settings().default_user_id


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate) -> ProjectOut:
    user_id = _user_id()
    with SessionLocal() as db:
        project = Project(name=body.name, user_id=user_id)
        db.add(project)
        db.commit()
        return ProjectOut.model_validate(project)


@router.get("", response_model=list[ProjectOut])
def list_projects() -> list[ProjectOut]:
    user_id = _user_id()
    with SessionLocal() as db:
        rows = db.scalars(
            select(Project).where(Project.user_id == user_id).order_by(Project.updated_at.desc())
        ).all()
        return [ProjectOut.model_validate(p) for p in rows]


@router.get("/{project_id}", response_model=dict)
def get_project(project_id: str) -> dict:
    user_id = _user_id()
    with SessionLocal() as db:
        project = db.scalars(
            select(Project).where(Project.id == project_id, Project.user_id == user_id)
        ).one_or_none()
        if project is None:
            raise HTTPException(status_code=404, detail="project not found")
        images = [ImageOut.model_validate(i) for i in project.images]
        return {
            "id": project.id,
            "name": project.name,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
            "images": images,
        }


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str) -> None:
    user_id = _user_id()
    with SessionLocal() as db:
        project = db.scalars(
            select(Project).where(Project.id == project_id, Project.user_id == user_id)
        ).one_or_none()
        if project is None:
            raise HTTPException(status_code=404, detail="project not found")
        for image in project.images:
            storage.delete_image_dir(user_id, image.id)
        db.delete(project)
        db.commit()