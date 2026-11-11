from fastapi import APIRouter, HTTPException
from backend.app.jobs.job_manager import job_manager

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/{job_id}")
async def get_job_status(job_id: str):
    """Retrieve the real-time execution status and progress of an asynchronous job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return job.to_dict()


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Request immediate cancellation of a running background acquisition job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    success = job_manager.request_cancellation(job_id)
    return {
        "job_id": job_id,
        "cancelled": success,
        "current_status": job.status.value,
    }
