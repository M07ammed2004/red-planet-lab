import React, { useEffect, useState } from 'react';
import type { JobInfo } from '../../types/api';
import { cancelJob, fetchJobStatus } from '../../services/api';

interface AcquisitionModalProps {
  jobId: string;
  sectorName: string;
  onComplete: () => void;
  onCancel: () => void;
}

const STAGES = [
  { key: 'CHECKING_CACHE', label: 'CACHE CHECK' },
  { key: 'SEARCHING_ARCHIVES', label: 'PDS ARCHIVES' },
  { key: 'DOWNLOADING_DEM', label: 'MOLA 128 DEM' },
  { key: 'DOWNLOADING_TEXTURE', label: 'VIKING TEXTURE' },
  { key: 'PROCESSING_TERRAIN', label: '3D SYNTHESIS' },
  { key: 'READY', label: 'READY' },
];

export const AcquisitionModal: React.FC<AcquisitionModalProps> = ({
  jobId,
  sectorName,
  onComplete,
  onCancel,
}) => {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: number;
    let isMounted = true;

    const poll = async () => {
      try {
        const info = await fetchJobStatus(jobId);
        if (!isMounted) return;
        setJob(info);

        if (info.status === 'COMPLETED') {
          setTimeout(() => {
            if (isMounted) onComplete();
          }, 600);
          return;
        }

        if (info.status === 'FAILED') {
          setError(info.error_message || 'Data retrieval or processing encountered a failure.');
          return;
        }

        if (info.status === 'CANCELLED') {
          onCancel();
          return;
        }

        timer = window.setTimeout(poll, 700);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Error communicating with acquisition pipeline');
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [jobId]);

  const handleCancelClick = async () => {
    setCancelling(true);
    try {
      await cancelJob(jobId);
      onCancel();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel job');
    } finally {
      setCancelling(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStageIndex = (stageKey?: string) => {
    if (!stageKey) return 0;
    const idx = STAGES.findIndex((s) => s.key === stageKey);
    return idx >= 0 ? idx : 1;
  };

  const currentStageIdx = getStageIndex(job?.stage);

  return (
    <div className="modal-backdrop">
      <div className="acquisition-modal-card">
        <div className="modal-header">
          <div className="header-left">
            <span className="modal-tag">AUTOMATED SCIENTIFIC ACQUISITION HUD</span>
            <h3 className="modal-title">{sectorName}</h3>
          </div>
          <div className="status-badge live">
            <span className="pulse-dot"></span> ORBITAL LINK ACTIVE
          </div>
        </div>

        {/* Pipeline Stages Stepper */}
        <div className="stages-stepper">
          {STAGES.map((s, idx) => {
            const isDone = idx < currentStageIdx || job?.status === 'COMPLETED';
            const isCurrent = idx === currentStageIdx && job?.status !== 'COMPLETED';
            return (
              <div
                key={s.key}
                className={`step-item ${isDone ? 'completed' : ''} ${
                  isCurrent ? 'active' : ''
                }`}
              >
                <div className="step-circle">
                  {isDone ? '✓' : idx + 1}
                </div>
                <span className="step-label">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar & Telemetry */}
        <div className="acquisition-body">
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${job?.progress_pct || 5}%` }}
            >
              <div className="progress-glow" />
            </div>
          </div>

          <div className="telemetry-grid">
            <div className="telemetry-box">
              <span className="telemetry-label">CURRENT OPERATION</span>
              <span className="telemetry-value">
                {job?.detail_message || 'Connecting to NASA Planetary Data System...'}
              </span>
            </div>

            <div className="telemetry-box">
              <span className="telemetry-label">DATA VOLUME</span>
              <span className="telemetry-value highlight">
                {job?.downloaded_bytes ? formatBytes(job.downloaded_bytes) : '0 MB'}
                {job?.total_bytes ? ` / ${formatBytes(job.total_bytes)}` : ''}
              </span>
            </div>

            <div className="telemetry-box">
              <span className="telemetry-label">COMPLETION</span>
              <span className="telemetry-value highlight">
                {job?.progress_pct ? `${job.progress_pct.toFixed(1)}%` : '0%'}
              </span>
            </div>

            <div className="telemetry-box">
              <span className="telemetry-label">PAYLOAD ITEM</span>
              <span className="telemetry-value mono">
                {job?.current_file || 'MOLA MEGDR 128 px/deg Slice'}
              </span>
            </div>
          </div>

          {error && (
            <div className="modal-error-box">
              <span>⚠️ {error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <span className="footer-note">
            Targeted acquisition only transfers necessary sector coordinates to conserve host storage.
          </span>
          <button
            className="btn btn-danger-outline"
            onClick={handleCancelClick}
            disabled={cancelling || job?.status === 'COMPLETED'}
          >
            {cancelling ? 'ABORTING...' : 'ABORT RETRIEVAL'}
          </button>
        </div>
      </div>
    </div>
  );
};
