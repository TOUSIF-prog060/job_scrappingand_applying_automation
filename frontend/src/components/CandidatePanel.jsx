import { useRef, useState } from 'react';
import { uploadResume } from '../api/jobsApi';
import CandidateEditModal from './CandidateEditModal';

export default function CandidatePanel({ candidate, onResumeUploaded, onCandidateUpdated }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null); // { text, type: 'ok'|'err' }
  const [showEditModal, setShowEditModal] = useState(false);

  if (!candidate) return null;

  const initials = `${candidate.firstName?.[0] ?? ''}${candidate.lastName?.[0] ?? ''}`;
  const hasResume = candidate.hasResume;

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await uploadResume(file);
      setUploadMsg({ text: `✅ "${file.name}" parsed & updated`, type: 'ok' });
      onResumeUploaded?.(res?.candidate);
    } catch (err) {
      setUploadMsg({ text: `❌ ${err.message}`, type: 'err' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <>
      <div className="candidate-panel">
        <div className="candidate-avatar">{initials}</div>

        <div className="candidate-info">
          <div className="candidate-name" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{candidate.firstName} {candidate.lastName}</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              onClick={() => setShowEditModal(true)}
              id="edit-profile-btn"
            >
              ✏️ Edit Profile & EEO
            </button>
          </div>
          <div className="candidate-details">
            {candidate.email}&nbsp;·&nbsp;{candidate.phone}&nbsp;·&nbsp;{candidate.location}
          </div>
          {candidate.skills?.length > 0 && (
            <div className="candidate-skills">
              {candidate.skills.map((s) => (
                <span key={s} className="skill-tag">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Right side — role info + resume upload */}
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            <div>{candidate.currentTitle}</div>
            <div>Gender: {candidate.gender || 'Not specified'} &nbsp;·&nbsp; Disability: {candidate.disabilityStatus ? 'Recorded ✓' : 'Default'}</div>
            {candidate.linkedin && (
              <a
                href={candidate.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="card-link"
                style={{ marginTop: 4, display: 'inline-flex' }}
              >
                LinkedIn ↗
              </a>
            )}
          </div>

          {/* Resume upload */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <input
              ref={fileInputRef}
              id="resume-upload-input"
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              className={`btn btn-sm ${hasResume && !uploadMsg ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              id="resume-upload-btn"
            >
              {uploading ? (
                <><span className="spinner" /> Uploading...</>
              ) : hasResume ? (
                '📄 Replace Resume'
              ) : (
                '📎 Upload Resume'
              )}
            </button>

            {/* Status line */}
            {uploadMsg ? (
              <span
                style={{
                  fontSize: '0.72rem',
                  color: uploadMsg.type === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)',
                }}
              >
                {uploadMsg.text}
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', color: hasResume ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {hasResume ? '✓ resume.pdf ready' : 'No resume uploaded yet'}
              </span>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <CandidateEditModal
          candidate={candidate}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            onCandidateUpdated?.(updated);
          }}
        />
      )}
    </>
  );
}
