/**
 * fieldMapper.js
 *
 * Maps form field labels found on the page to candidate JSON keys.
 * Matching is case-insensitive and substring-based — e.g. a label "First Name *"
 * matches the rule for "first name".
 *
 * Each entry: { patterns: string[], key: string, type: 'text' | 'select' | 'file' | 'checkbox' }
 */

const FIELD_MAP = [
  // ── Personal info ─────────────────────────────────────────────
  { patterns: ['first name', 'given name', 'firstname'], key: 'firstName', type: 'text' },
  { patterns: ['last name', 'surname', 'family name', 'lastname'], key: 'lastName', type: 'text' },
  { patterns: ['full name', 'your name'], key: 'fullName', type: 'text' }, // virtual — see below
  { patterns: ['email', 'e-mail', 'email address'], key: 'email', type: 'text' },
  { patterns: ['phone', 'telephone', 'mobile', 'phone number'], key: 'phone', type: 'text' },
  { patterns: ['location', 'city', 'current location', 'where are you located'], key: 'location', type: 'text' },

  // ── Links ──────────────────────────────────────────────────────
  { patterns: ['linkedin', 'linkedin url', 'linkedin profile'], key: 'linkedin', type: 'text' },
  { patterns: ['github', 'github url', 'github profile'], key: 'github', type: 'text' },
  { patterns: ['website', 'portfolio', 'personal website', 'personal site'], key: 'website', type: 'text' },

  // ── Work / Education ───────────────────────────────────────────
  { patterns: ['current title', 'job title', 'current job', 'current position'], key: 'currentTitle', type: 'text' },
  { patterns: ['education', 'degree', 'highest education'], key: 'education', type: 'text' },
  { patterns: ['experience', 'years of experience'], key: 'experience', type: 'text' },
  { patterns: ['salary', 'expected salary', 'desired salary', 'compensation'], key: 'salary', type: 'text' },
  { patterns: ['start date', 'available to start', 'when can you start'], key: 'startDate', type: 'text' },

  // ── EEO / legal ───────────────────────────────────────────────
  { patterns: ['gender'], key: 'gender', type: 'select' },
  { patterns: ['race', 'ethnicity', 'racial'], key: 'ethnicity', type: 'select' },
  { patterns: ['veteran', 'protected veteran'], key: 'veteranStatus', type: 'select' },
  { patterns: ['disability'], key: 'disabilityStatus', type: 'select' },
  { patterns: ['authorized', 'work authorization', 'legally authorized'], key: 'workAuthorization', type: 'select' },
  { patterns: ['sponsorship', 'visa', 'require sponsorship'], key: 'requiresSponsorship', type: 'select' },

  // ── Cover letter / essays / additional info ────────────────────
  { patterns: ['additional information', 'additional info', 'additional comments', 'eeo comments', 'anything else', 'other information'], key: 'additionalInfo', type: 'text' },
  { patterns: ['cover letter', 'why do you want', 'tell us about yourself'], key: 'coverLetter', type: 'text' },
  { patterns: ['how did you hear', 'referral', 'referred by'], key: 'referral', type: 'text' },
];

/**
 * Given a label string, return the matching candidate key (or null).
 */
function findMatchingKey(label) {
  const lower = label.toLowerCase().trim();
  for (const rule of FIELD_MAP) {
    for (const pattern of rule.patterns) {
      if (lower.includes(pattern)) {
        return { key: rule.key, type: rule.type };
      }
    }
  }
  return null;
}

/**
 * Given a candidate object, return the value for a key.
 * Handles the virtual 'fullName' key.
 */
function getCandidateValue(candidate, key) {
  if (key === 'fullName') {
    return `${candidate.firstName} ${candidate.lastName}`;
  }
  return candidate[key] ?? '';
}

module.exports = { FIELD_MAP, findMatchingKey, getCandidateValue };
