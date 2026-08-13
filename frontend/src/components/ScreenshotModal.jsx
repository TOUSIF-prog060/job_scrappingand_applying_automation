import { useState } from 'react';

export default function ScreenshotModal({ job, onClose }) {
  if (!job) return null;

  const primaryUrl = `/api/applications/${job.id}/screenshot?t=${job.updated_at || Date.now()}`;
  const fallbackUrl = `/screenshots/${job.id}.png`;

  const [imgSrc, setImgSrc] = useState(primaryUrl);
  const [hasError, setHasError] = useState(false);
  const [zoom, setZoom] = useState(1);

  function handleError() {
    if (imgSrc !== fallbackUrl) {
      setImgSrc(fallbackUrl);
    } else {
      setHasError(true);
    }
  }

  function handleZoomIn() {
    setZoom((prev) => Math.min(prev + 0.25, 4.0));
  }

  function handleZoomOut() {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }

  function handleResetZoom() {
    setZoom(1);
  }

  function handleWheel(e) {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px', width: '92vw' }}>
        
        {/* Header with Zoom Toolbar */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span className="modal-title" style={{ fontSize: '0.98rem' }}>
            📸 Screenshot Proof — {job.title} ({job.company})
          </span>

          {/* Zoom Controls */}
          {!hasError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom Out"
                style={{ padding: '2px 8px', fontSize: '0.85rem' }}
              >
                🔍 −
              </button>

              <span style={{ fontSize: '0.78rem', fontWeight: 600, minWidth: '46px', textAlign: 'center', color: 'var(--accent-emerald-light)' }}>
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleZoomIn}
                disabled={zoom >= 4.0}
                title="Zoom In"
                style={{ padding: '2px 8px', fontSize: '0.85rem' }}
              >
                🔍 +
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetZoom}
                title="Reset Zoom"
                style={{ padding: '2px 8px', fontSize: '0.75rem', marginLeft: '4px' }}
              >
                ↺ Reset
              </button>
            </div>
          )}

          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Modal Image Body with Zoom & Pan Container */}
        <div
          className="modal-body"
          onWheel={handleWheel}
          style={{
            minHeight: '380px',
            maxHeight: '78vh',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#080d18',
            cursor: zoom > 1 ? 'grab' : 'zoom-in',
          }}
        >
          {hasError ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🖼️ Proof Screenshot Unavailable</p>
              <p style={{ fontSize: '0.85rem' }}>No screenshot proof file was found on disk for this job. Apply to this job to generate proof screenshot.</p>
            </div>
          ) : (
            <div style={{ overflow: 'auto', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={imgSrc}
                alt={`Screenshot for ${job.title}`}
                onError={handleError}
                onClick={() => setZoom((prev) => (prev === 1 ? 1.5 : 1))}
                style={{
                  maxWidth: zoom === 1 ? '100%' : 'none',
                  maxHeight: zoom === 1 ? '72vh' : 'none',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
                  display: 'block',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
