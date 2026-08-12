import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { applyToJob, openFilledBrowserApi } from '../api/jobsApi';

const PROCESSING_STATUSES = new Set(['PROCESSING', 'FORM_FILLED', 'READY_FOR_SUBMISSION']);

export default function JobCard({ job, candidate, allowSubmit = false, onApplyStart, onScreenshot }) {
  const [applying, setApplying] = useState(false);
  const [openingBrowser, setOpeningBrowser] = useState(false);
  const [error, setError] = useState(null);

  const isProcessing = PROCESSING_STATUSES.has(job.status);
  const isDone = job.status === 'SCREENSHOT_CAPTURED';
  const isFailed = job.status === 'FAILED';

  const statusClass = {
    NOT_STARTED: '',
    PROCESSING: 'status-processing',
    FORM_FILLED: 'status-processing',
    READY_FOR_SUBMISSION: 'status-processing',
    SCREENSHOT_CAPTURED: 'status-done',
    FAILED: 'status-failed',
  }[job.status] || '';

  async function handleApply() {
    if (applying || isProcessing || isDone) return;
    setApplying(true);
    setError(null);
    try {
      await applyToJob(job.id, allowSubmit);
      onApplyStart?.(job.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  }

  async function handleOpenBrowser(e) {
    if (e) e.preventDefault();
    setOpeningBrowser(true);
    setError(null);
    try {
      await openFilledBrowserApi(job.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setOpeningBrowser(false);
    }
  }

  const initials = (job.company || '?').charAt(0).toUpperCase();

  return (
    <article className={`job-card ${statusClass}`}>
      <div className="card-header">
        <div className="card-company-badge">{initials}</div>
        <div className="card-title-group">
          <h3 className="card-title">{job.title}</h3>
          <span className="card-company">{job.company}</span>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="card-meta">
        <span className="card-meta-item">📍 {job.location || 'Unknown'}</span>
        <span className="card-meta-item">🏷️ {job.source || 'greenhouse'}</span>
      </div>

      {job.description && (
        <p className="card-description">{job.description}</p>
      )}

      {isFailed && job.failure_reason && (
        <div className="failure-reason">
          ⚠️ {job.failure_reason}
        </div>
      )}

      {error && (
        <div className="failure-reason">❌ {error}</div>
      )}

      <div className="card-footer">
        <button
          type="button"
          onClick={handleOpenBrowser}
          disabled={openingBrowser}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-blue-light)',
            cursor: openingBrowser ? 'wait' : 'pointer',
            padding: 0,
            fontSize: '0.85rem',
            fontWeight: 500,
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Click to launch live pre-filled Chromium window on your screen"
        >
          {openingBrowser ? '⏳ Opening Filled Form...' : '⚡ View Filled Form ↗'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isDone && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onScreenshot?.(job)}
              id={`screenshot-btn-${job.id}`}
            >
              📸 Screenshot
            </button>
          )}

          <button
            className="btn btn-primary btn-sm"
            onClick={handleOpenBrowser}
            disabled={openingBrowser}
            title="Launches live Chromium window with all candidate fields pre-filled by Playwright"
          >
            {openingBrowser ? '🖥️ Opening...' : '👁️ View Filled Form'}
          </button>

          {!isDone && (
            <button
              className={`btn btn-sm ${isProcessing ? 'btn-ghost' : 'btn-primary'}`}
              onClick={handleApply}
              disabled={applying || isProcessing}
              id={`apply-btn-${job.id}`}
            >
              {applying || isProcessing ? (
                <>
                  <span className="spinner" />
                  {isProcessing ? 'Running...' : 'Starting...'}
                </>
              ) : (
                isFailed ? '🔄 Retry' : '⚡ Apply'
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
