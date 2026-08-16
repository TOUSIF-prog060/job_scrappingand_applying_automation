export default function StatusBadge({ status }) {
  const config = {
    NOT_STARTED: { label: 'Not Started', cls: 'badge-not-started' },
    PROCESSING: { label: 'Processing', cls: 'badge-processing' },
    FORM_FILLED: { label: 'Form Filled', cls: 'badge-form-filled' },
    READY_FOR_SUBMISSION: { label: 'Ready', cls: 'badge-ready' },
    SCREENSHOT_CAPTURED: { label: 'Completed ✓', cls: 'badge-done' },
    MANUAL_INTERVENTION_REQUIRED: { label: '🔐 CAPTCHA — Manual', cls: 'badge-manual' },
    FAILED: { label: 'Failed', cls: 'badge-failed' },
  };

  const { label, cls } = config[status] || { label: status, cls: 'badge-not-started' };

  return (
    <span className={`status-badge ${cls}`}>
      <span className="dot" />
      {label}
    </span>
  );
}
