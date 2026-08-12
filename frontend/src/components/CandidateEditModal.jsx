import { useState } from 'react';
import { updateCandidate } from '../api/jobsApi';

export default function CandidateEditModal({ candidate, onClose, onSaved }) {
  const [form, setForm] = useState({
    firstName: candidate.firstName || '',
    lastName: candidate.lastName || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    location: candidate.location || '',
    linkedin: candidate.linkedin || '',
    github: candidate.github || '',
    website: candidate.website || '',
    currentTitle: candidate.currentTitle || '',
    education: candidate.education || '',
    gender: candidate.gender || 'Male',
    ethnicity: candidate.ethnicity || 'Asian',
    veteranStatus: candidate.veteranStatus || 'I am not a protected veteran',
    disabilityStatus: candidate.disabilityStatus || 'I do not have a disability',
    workAuthorization: candidate.workAuthorization || 'Yes',
    requiresSponsorship: candidate.requiresSponsorship || 'No',
    salary: candidate.salary || '90000',
    coverLetter: candidate.coverLetter || '',
    additionalInfo: candidate.additionalInfo || 'N/A - No additional requirements.',
    skills: Array.isArray(candidate.skills) ? candidate.skills.join(', ') : '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const skillsArray = form.skills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const payload = {
        ...form,
        skills: skillsArray,
      };

      const res = await updateCandidate(payload);
      onSaved?.(res.candidate);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '680px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">✏️ Edit Candidate Profile & EEO Demographic Answers</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '78vh' }}>
          {error && (
            <div style={{ color: 'var(--accent-red)', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
              ❌ {error}
            </div>
          )}

          {/* Section: Basic Info */}
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-blue-light)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '4px' }}>
            👤 Personal Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>First Name</label>
              <input
                type="text"
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Last Name</label>
              <input
                type="text"
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Phone</label>
              <input
                type="text"
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Location</label>
              <input
                type="text"
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Current Title</label>
              <input
                type="text"
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.currentTitle}
                onChange={(e) => handleChange('currentTitle', e.target.value)}
              />
            </div>
          </div>

          {/* Section: EEO & Demographics */}
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-blue-light)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '4px', marginTop: '8px' }}>
            ⚖️ EEO & Demographic Form Answers (Auto-filled into form dropdowns)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Gender</label>
              <select
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="I decline to self-identify">Decline to self-identify</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Race / Ethnicity</label>
              <select
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.ethnicity}
                onChange={(e) => handleChange('ethnicity', e.target.value)}
              >
                <option value="Asian">Asian</option>
                <option value="White">White</option>
                <option value="Black or African American">Black or African American</option>
                <option value="Hispanic or Latino">Hispanic or Latino</option>
                <option value="Two or More Races">Two or More Races</option>
                <option value="I decline to self-identify">Decline to self-identify</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Disability Status</label>
              <select
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.disabilityStatus}
                onChange={(e) => handleChange('disabilityStatus', e.target.value)}
              >
                <option value="I do not have a disability">No, I do not have a disability</option>
                <option value="Yes, I have a disability">Yes, I have a disability</option>
                <option value="I do not wish to answer">I do not wish to answer</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Veteran Status</label>
              <select
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.veteranStatus}
                onChange={(e) => handleChange('veteranStatus', e.target.value)}
              >
                <option value="I am not a protected veteran">I am not a protected veteran</option>
                <option value="I identify as one or more of the classifications of protected veteran">Protected veteran</option>
                <option value="I decline to self-identify">Decline to self-identify</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Work Authorization</label>
              <select
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.workAuthorization}
                onChange={(e) => handleChange('workAuthorization', e.target.value)}
              >
                <option value="Yes">Yes (Authorized to work)</option>
                <option value="No">No</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Requires Sponsorship</label>
              <select
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.requiresSponsorship}
                onChange={(e) => handleChange('requiresSponsorship', e.target.value)}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>

          {/* Section: Additional EEO / Info */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Additional Information / EEO Comments Section</label>
            <textarea
              className="search-input"
              rows={2}
              style={{ padding: '8px 12px', resize: 'vertical' }}
              placeholder="Comments or additional details auto-filled into form 'Additional Information' fields..."
              value={form.additionalInfo}
              onChange={(e) => handleChange('additionalInfo', e.target.value)}
            />
          </div>

          {/* Section: Links & Fallbacks */}
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-blue-light)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '4px', marginTop: '8px' }}>
            🔗 Social Links & Skills
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>LinkedIn</label>
              <input
                type="text"
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.linkedin}
                onChange={(e) => handleChange('linkedin', e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>GitHub</label>
              <input
                type="text"
                className="search-input"
                style={{ padding: '8px 12px' }}
                value={form.github}
                onChange={(e) => handleChange('github', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Skills (comma-separated)</label>
            <input
              type="text"
              className="search-input"
              style={{ padding: '8px 12px' }}
              value={form.skills}
              onChange={(e) => handleChange('skills', e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Cover Letter / Custom Question Fallback</label>
            <textarea
              className="search-input"
              rows={2}
              style={{ padding: '8px 12px', resize: 'vertical' }}
              value={form.coverLetter}
              onChange={(e) => handleChange('coverLetter', e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : '💾 Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
