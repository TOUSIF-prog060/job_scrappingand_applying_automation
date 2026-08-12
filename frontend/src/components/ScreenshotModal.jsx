export default function ScreenshotModal({ job, onClose }) {
  if (!job) return null;

  const url = `/api/applications/${job.id}/screenshot`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📸 Screenshot — {job.title}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <img
            src={url}
            alt={`Screenshot for ${job.title}`}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<p style="color:#94a3b8;padding:40px">Screenshot could not be loaded.</p>';
            }}
          />
        </div>
      </div>
    </div>
  );
}
