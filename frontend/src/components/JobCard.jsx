import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { applyToJob } from '../api/jobsApi';

const PROCESSING_STATUSES = new Set(['PROCESSING', 'FORM_FILLED', 'READY_FOR_SUBMISSION']);

export default function JobCard({ job, candidate, allowSubmit = false, onApplyStart, onScreenshot }) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const isProcessing = PROCESSING_STATUSES.has(job.status);
  const isDone = job.status === 'SCREENSHOT_CAPTURED' || job.status === 'READY_FOR_REVIEW';
  const isFailed = job.status === 'FAILED';

  const statusClass = {
    NOT_STARTED: '',
    PROCESSING: 'status-processing',
    FORM_FILLED: 'status-processing',
    READY_FOR_SUBMISSION: 'status-processing',
    READY_FOR_REVIEW: 'status-done',
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

  const initials = (job.company || '?').charAt(0).toUpperCase();
  const matchScore = Number(job.match_score || 0);
  const matchedSkills = Array.isArray(job.matched_skills) ? job.matched_skills : [];

  const matchBadgeStyle =
    matchScore >= 75
      ? { bg: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399' }
      : matchScore >= 50
      ? { bg: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24' }
      : { bg: 'rgba(107, 114, 128, 0.15)', border: '1px solid rgba(107, 114, 128, 0.4)', color: '#9ca3af' };

  return (
    <article className={`job-card ${statusClass}`}>
      <div className="card-header">
        <div className="card-company-badge">{initials}</div>
        <div className="card-title-group">
          <h3 className="card-title">{job.title}</h3>
          <span className="card-company">{job.company}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <StatusBadge status={job.status} />
          {matchScore > 0 && (
            <span
              style={{
                background: matchBadgeStyle.bg,
                border: matchBadgeStyle.border,
                color: matchBadgeStyle.color,
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                whiteSpace: 'nowrap',
              }}
              title="Resume Match Relevancy Score"
            >
              🎯 {matchScore}% Match
            </span>
          )}
        </div>
      </div>

      <div className="card-meta">
        <span className="card-meta-item">📍 {job.location || 'Unknown'}</span>
        <span className="card-meta-item">🏢 {job.company_board || job.company}</span>
      </div>

      {matchedSkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0 10px 0' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginRight: '2px' }}>Matching:</span>
          {matchedSkills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: 'var(--accent-blue-light)',
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '0.7rem',
                fontWeight: 500,
              }}
            >
              {skill}
            </span>
          ))}
          {matchedSkills.length > 5 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              +{matchedSkills.length - 5} more
            </span>
          )}
        </div>
      )}

      {job.description && (
        <p className="card-description">
          {job.description.replace(/<[^>]*>/g, '').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim()}
        </p>
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
        {job.application_url || job.job_url ? (
          <a
            href={job.application_url || job.job_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--accent-blue-light)',
              fontSize: '0.85rem',
              fontWeight: 500,
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Open direct job application link in a new tab"
          >
            🔗 Form Link ↗
          </a>
        ) : <span />}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isDone && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onScreenshot?.(job)}
              id={`screenshot-btn-${job.id}`}
            >
              📸 Screenshot Proof
            </button>
          )}

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
