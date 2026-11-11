import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
import uuid


class JobStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class JobStage(str, Enum):
    QUEUED = "QUEUED"
    CHECKING_CACHE = "CHECKING_CACHE"
    SEARCHING_ARCHIVES = "SEARCHING_ARCHIVES"
    DOWNLOADING_DEM = "DOWNLOADING_DEM"
    DOWNLOADING_TEXTURE = "DOWNLOADING_TEXTURE"
    PROCESSING_TERRAIN = "PROCESSING_TERRAIN"
    GENERATING_3D_MESH = "GENERATING_3D_MESH"
    READY = "READY"


@dataclass
class JobInfo:
    job_id: str
    sector_id: str
    status: JobStatus = JobStatus.PENDING
    stage: JobStage = JobStage.QUEUED
    progress_pct: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: int = 0
    current_file: str = ""
    detail_message: str = "Job created"
    error_message: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    result: Optional[dict[str, Any]] = None
    _cancelled: bool = False
    _cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "sector_id": self.sector_id,
            "status": self.status.value,
            "stage": self.stage.value,
            "progress_pct": round(self.progress_pct, 1),
            "downloaded_bytes": self.downloaded_bytes,
            "total_bytes": self.total_bytes,
            "current_file": self.current_file,
            "detail_message": self.detail_message,
            "error_message": self.error_message,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "is_cancelled": self._cancelled,
            "result": self.result,
        }


class JobManager:
    """In-memory asynchronous background job manager with cancellation and progress reporting."""

    def __init__(self):
        self._jobs: dict[str, JobInfo] = {}
        self._lock = asyncio.Lock()

    def create_job(self, sector_id: str) -> JobInfo:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        job = JobInfo(job_id=job_id, sector_id=sector_id)
        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[JobInfo]:
        return self._jobs.get(job_id)

    def get_active_job_for_sector(self, sector_id: str) -> Optional[JobInfo]:
        for job in self._jobs.values():
            if job.sector_id == sector_id and job.status in (JobStatus.PENDING, JobStatus.RUNNING):
                return job
        return None

    def update_progress(
        self,
        job_id: str,
        stage: JobStage,
        progress_pct: float,
        downloaded_bytes: int = 0,
        total_bytes: int = 0,
        current_file: str = "",
        detail_message: str = "",
    ) -> None:
        job = self._jobs.get(job_id)
        if not job or job._cancelled:
            return

        job.status = JobStatus.RUNNING
        job.stage = stage
        job.progress_pct = max(0.0, min(100.0, progress_pct))
        if downloaded_bytes > 0:
            job.downloaded_bytes = downloaded_bytes
        if total_bytes > 0:
            job.total_bytes = total_bytes
        if current_file:
            job.current_file = current_file
        if detail_message:
            job.detail_message = detail_message
        job.updated_at = datetime.now(timezone.utc).isoformat()

    def mark_completed(self, job_id: str, result: Optional[dict[str, Any]] = None) -> None:
        job = self._jobs.get(job_id)
        if not job:
            return
        job.status = JobStatus.COMPLETED
        job.stage = JobStage.READY
        job.progress_pct = 100.0
        job.detail_message = "Terrain acquisition and 3D reconstruction complete"
        job.result = result
        job.updated_at = datetime.now(timezone.utc).isoformat()

    def mark_failed(self, job_id: str, error_message: str) -> None:
        job = self._jobs.get(job_id)
        if not job:
            return
        job.status = JobStatus.FAILED
        job.error_message = error_message
        job.detail_message = f"Failed: {error_message}"
        job.updated_at = datetime.now(timezone.utc).isoformat()

    def request_cancellation(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if not job:
            return False
        if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
            return False
        job._cancelled = True
        job._cancel_event.set()
        job.status = JobStatus.CANCELLED
        job.detail_message = "Job cancelled by operator"
        job.updated_at = datetime.now(timezone.utc).isoformat()
        return True

    def is_cancelled(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        return bool(job and job._cancelled)


job_manager = JobManager()
