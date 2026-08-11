from fastapi import APIRouter

from ...core.admin import AdminUser
from ...core.exceptions import AppError
from . import service

router = APIRouter(prefix="/admin/jobs", tags=["jobs"])


@router.get("/metrics")
async def job_metrics(_admin: AdminUser):
    return await service.get_metrics()


@router.get("/dead-letter")
async def dead_letter_jobs(_admin: AdminUser):
    return {"jobs": await service.list_dead_letter()}


@router.post("/{job_id}/retry")
async def retry_job(job_id: str, _admin: AdminUser):
    retried = await service.retry_dead_job(job_id)
    if not retried:
        raise AppError("Dead-letter job not found", 404)
    return {"retried": True}


@router.post("/{job_id}/discard")
async def discard_job(job_id: str, _admin: AdminUser):
    discarded = await service.discard_job(job_id)
    if not discarded:
        raise AppError("Dead-letter job not found", 404)
    return {"discarded": True}
