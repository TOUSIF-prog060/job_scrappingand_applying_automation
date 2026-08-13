import { useState } from 'react';
import { applyToAll, stopApplyAll } from '../api/jobsApi';

export default function ApplyAllButton({ eligibleJobIds = [], stats = {}, progress, allowSubmit = false, onStarted, onStopped }) {
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState(null);

  const isRunning = progress?.running;
  const total = progress?.total ?? 0;
  const done = (progress?.completed ?? 0) + (progress?.failed ?? 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const countToApply = eligibleJobIds.length > 0 ? eligibleJobIds.length : (stats.not_started ?? 0);

  async function handleApplyAll() {
    if (loading || isRunning || countToApply === 0) return;
    setLoading(true);
    setError(null);
    try {
      await applyToAll(allowSubmit, eligibleJobIds);
      onStarted?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStopApplyAll() {
    if (stopping) return;
    setStopping(true);
    try {
      await stopApplyAll();
      onStopped?.();
    } catch (e) {
      setError(`Failed to stop: ${e.message}`);
    } finally {
      setStopping(false);
    }
  }

  return (
    <div>
      {isRunning && (
        <div className="progress-bar-wrap">
          <div className="progress-header">
            <span className="progress-title">
              <span className="spinner" style={{ borderTopColor: '#10b981' }} />
              Applying to filtered jobs...
            </span>
            <span className="progress-counts">
              {done} / {total} &nbsp;•&nbsp;
              <span style={{ color: '#34d399' }}>{progress.completed ?? 0} done</span> &nbsp;•&nbsp;
              <span style={{ color: '#fb7185' }}>{progress.failed ?? 0} failed</span>
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {isRunning ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleStopApplyAll}
            disabled={stopping}
          >
            {stopping ? (
              <>
                <span className="spinner" />
                Cancelling Apply-All...
              </>
            ) : (
              <>🛑 Cancel Apply-All ({pct}%)</>
            )}
          </button>
        ) : (
          <button
            id="apply-all-btn"
            className="btn btn-success"
            onClick={handleApplyAll}
            disabled={loading || countToApply === 0}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Starting...
              </>
            ) : (
              <>⚡ Apply to All Visible ({countToApply} job{countToApply !== 1 ? 's' : ''})</>
            )}
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--accent-rose)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
