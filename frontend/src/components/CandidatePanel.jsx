import { useRef, useState } from 'react';
import { uploadResume, uploadCoverLetter } from '../api/jobsApi';
import CandidateEditModal from './CandidateEditModal';

export default function CandidatePanel({ candidate, onResumeUploaded, onCandidateUpdated }) {
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [coverMsg, setCoverMsg] = useState(null);
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
      setUploadMsg({ text: `✅ Resume "${file.name}" parsed & updated`, type: 'ok' });
      onResumeUploaded?.(res?.candidate);
    } catch (err) {
      setUploadMsg({ text: `❌ ${err.message}`, type: 'err' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleCoverChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    setCoverMsg(null);
    try {
      const res = await uploadCoverLetter(file);
      setCoverMsg({ text: `✅ Cover Letter "${file.name}" uploaded`, type: 'ok' });
      onCandidateUpdated?.(res?.candidate);
    } catch (err) {
      setCoverMsg({ text: `❌ ${err.message}`, type: 'err' });
    } finally {
      setUploadingCover(false);
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

          {/* Dual Document Upload Section */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {/* Resume Upload */}
            <input
              ref={fileInputRef}
              id="resume-upload-input"
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              className={`btn btn-sm ${hasResume && !uploadMsg ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              id="resume-upload-btn"
              title="Upload PDF or Word (.docx) resume"
            >
              {uploading ? (
                <><span className="spinner" /> Uploading...</>
              ) : hasResume ? (
                `📄 ${candidate.resumeFileName || 'resume'} (Replace)`
              ) : (
                '📎 Upload Resume'
              )}
            </button>

            {/* Cover Letter Upload */}
            <input
              ref={coverInputRef}
              id="cover-upload-input"
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              style={{ display: 'none' }}
              onChange={handleCoverChange}
            />
            <button
              type="button"
              className={`btn btn-sm ${candidate.hasCoverLetter ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              id="cover-upload-btn"
              title="Upload PDF, Word (.docx), or TXT cover letter document"
            >
              {uploadingCover ? (
                <><span className="spinner" /> Uploading...</>
              ) : candidate.hasCoverLetter ? (
                `📝 ${candidate.coverLetterFileName || 'cover_letter'} (Replace)`
              ) : (
                '✉️ Upload Cover Letter'
              )}
            </button>
          </div>

          {/* Status Messages */}
          <div style={{ marginTop: '4px', fontSize: '0.72rem' }}>
            {uploadMsg ? (
              <span style={{ color: uploadMsg.type === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {uploadMsg.text}
              </span>
            ) : coverMsg ? (
              <span style={{ color: coverMsg.type === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {coverMsg.text}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                {hasResume ? `✓ ${candidate.resumeFileName || 'Resume'} ready` : 'No resume uploaded'}
                {candidate.hasCoverLetter ? ` · ✓ ${candidate.coverLetterFileName || 'Cover Letter'} ready` : ''}
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
