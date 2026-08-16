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
  { patterns: ['first name', 'given name', 'firstname', 'first_name'], key: 'firstName', type: 'text' },
  { patterns: ['last name', 'surname', 'family name', 'lastname', 'last_name'], key: 'lastName', type: 'text' },
  { patterns: ['full name', 'your name', 'name', 'applicant name'], key: 'fullName', type: 'text' }, // virtual — see below
  { patterns: ['email', 'e-mail', 'email address', 'email_address', 'applicant email'], key: 'email', type: 'text' },
  { patterns: ['phone', 'telephone', 'mobile', 'phone number', 'phone_number', 'contact phone'], key: 'phone', type: 'text' },
  { patterns: ['location', 'city', 'current location', 'where are you located'], key: 'location', type: 'text' },

  // ── Links ──────────────────────────────────────────────────────
  { patterns: ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin_url'], key: 'linkedin', type: 'text' },
  { patterns: ['github', 'github url', 'github profile', 'github_url'], key: 'github', type: 'text' },
  { patterns: ['website', 'portfolio', 'personal website', 'personal site', 'website_url', 'portfolio_url'], key: 'website', type: 'text' },

  // ── Work / Education ───────────────────────────────────────────
  { patterns: ['current title', 'job title', 'current job', 'current position', 'title', 'position'], key: 'currentTitle', type: 'text' },
  { patterns: ['education', 'degree', 'highest education', 'school', 'university'], key: 'education', type: 'text' },
  { patterns: ['experience', 'years of experience', 'years experience'], key: 'experience', type: 'text' },
  { patterns: ['salary', 'expected salary', 'desired salary', 'compensation', 'salary expectation'], key: 'salary', type: 'text' },
  { patterns: ['start date', 'available to start', 'when can you start', 'availability'], key: 'startDate', type: 'text' },

  // ── EEO / legal ───────────────────────────────────────────────
  { patterns: ['gender'], key: 'gender', type: 'select' },
  { patterns: ['race', 'ethnicity', 'racial', 'ethnicity/race'], key: 'ethnicity', type: 'select' },
  { patterns: ['veteran', 'protected veteran', 'veteran status'], key: 'veteranStatus', type: 'select' },
  { patterns: ['disability', 'disability status'], key: 'disabilityStatus', type: 'select' },
  { patterns: ['authorized', 'work authorization', 'legally authorized', 'work permit'], key: 'workAuthorization', type: 'select' },
  { patterns: ['sponsorship', 'visa', 'require sponsorship', 'visa sponsorship'], key: 'requiresSponsorship', type: 'select' },

  // ── Cover letter / essays / additional info ────────────────────
  { patterns: ['additional information', 'additional info', 'additional comments', 'eeo comments', 'anything else', 'other information'], key: 'additionalInfo', type: 'text' },
  { patterns: ['cover letter', 'why do you want', 'tell us about yourself', 'cover_letter'], key: 'coverLetter', type: 'text' },
  { patterns: ['how did you hear', 'hear about', 'first hear', 'referral', 'referred by', 'referral source'], key: 'referral', type: 'text' },
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
