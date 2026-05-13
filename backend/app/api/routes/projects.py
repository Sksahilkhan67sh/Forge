from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.db.database import get_db
from app.db.models import Project
from app.schemas.api import (
    IndexProjectRequest,
    IndexProjectResponse,
    ProjectCreate,
    ProjectResponse,
)
from app.services.rag import index_directory

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project = Project(user_id=user_id, **body.model_dump())
    db.add(project)
    await db.flush()
    return project


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.user_id == user_id).order_by(Project.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await _get_project(project_id, user_id, db)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user_id, db)
    await db.delete(project)


@router.post("/{project_id}/index", response_model=IndexProjectResponse)
async def index_project(
    project_id: UUID,
    body: IndexProjectRequest,
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Trigger RAG indexing for a project directory. Runs in background."""
    project = await _get_project(project_id, user_id, db)

    # Run synchronously for MVP; move to queue (BullMQ/Celery) for production
    result = await index_directory(
        db=db,
        project=project,
        directory=body.directory,
        force_reindex=body.force_reindex,
    )
    return IndexProjectResponse(project_id=project.id, **result)


async def _get_project(project_id: UUID, user_id: UUID, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
