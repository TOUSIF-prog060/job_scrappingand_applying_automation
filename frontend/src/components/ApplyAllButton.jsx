import { useState } from 'react';
import { applyToAll } from '../api/jobsApi';

export default function ApplyAllButton({ stats = {}, progress, allowSubmit = false, onStarted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isRunning = progress?.running;
  const total = progress?.total ?? 0;
  const done = (progress?.completed ?? 0) + (progress?.failed ?? 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function handleApplyAll() {
    if (loading || isRunning) return;
    setLoading(true);
    setError(null);
    try {
      await applyToAll(allowSubmit);
      onStarted?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {isRunning && (
        <div className="progress-bar-wrap">
          <div className="progress-header">
            <span className="progress-title">
              <span className="spinner" style={{ borderTopColor: '#60a5fa' }} />
              Applying to all jobs...
            </span>
            <span className="progress-counts">
              {done} / {total} &nbsp;•&nbsp;
              <span style={{ color: '#34d399' }}>{progress.completed ?? 0} done</span> &nbsp;•&nbsp;
              <span style={{ color: '#f87171' }}>{progress.failed ?? 0} failed</span>
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <button
        id="apply-all-btn"
        className="btn btn-success"
        onClick={handleApplyAll}
        disabled={loading || isRunning || (stats.not_started ?? 0) === 0}
      >
        {loading || isRunning ? (
          <>
            <span className="spinner" />
            {isRunning ? `Running (${pct}%)` : 'Starting...'}
          </>
        ) : (
          <>⚡ Apply to All ({stats.not_started ?? 0} jobs)</>
        )}
      </button>

      {error && (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
