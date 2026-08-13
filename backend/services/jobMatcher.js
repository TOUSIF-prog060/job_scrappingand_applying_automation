/**
 * Enhanced Resume-to-Job Relevancy Matching Engine
 * Performs multi-factor semantic alignment:
 *  1. Technical Skill Overlap & Density (40% weight)
 *  2. Role Title & Core Domain Similarity (30% weight)
 *  3. Experience Level & Seniority Alignment (15% weight)
 *  4. Location & Remote Flexibility (15% weight)
 */

const SENIORITY_LEVELS = ['intern', 'junior', 'associate', 'mid', 'senior', 'staff', 'principal', 'lead', 'director', 'vp', 'head', 'manager'];

/**
 * Calculate match score (0-100%), matched skills, and detailed match breakdown reasons.
 * 
 * @param {Object} job - Scraped job object { title, description, location, company }
 * @param {Object} candidate - Candidate profile { skills, currentTitle, experience, location, ... }
 * @returns {{ matchScore: number, matchedSkills: string[], matchReasons: string[] }}
 */
function calculateJobMatch(job = {}, candidate = {}) {
  const candidateSkills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobText = `${jobTitle} ${jobDesc}`;
  const matchReasons = [];

  // ── 1. Technical Skill Overlap & Density (40% weight) ────────────────────────
  const matchedSkillsSet = new Set();
  let skillDensityCount = 0;

  for (const skill of candidateSkills) {
    if (!skill || typeof skill !== 'string') continue;
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = jobText.match(regex);
    if (matches && matches.length > 0) {
      matchedSkillsSet.add(skill);
      skillDensityCount += matches.length;
    }
  }

  const matchedSkills = Array.from(matchedSkillsSet);
  let skillScore = 0;
  if (candidateSkills.length > 0) {
    const overlapRatio = matchedSkills.length / Math.min(candidateSkills.length, 10);
    const densityBonus = Math.min(0.2, skillDensityCount * 0.02);
    skillScore = Math.min(1.0, overlapRatio + densityBonus) * 40;
  } else {
    skillScore = 15;
  }

  if (matchedSkills.length > 0) {
    matchReasons.push(`${matchedSkills.length} matching skill${matchedSkills.length > 1 ? 's' : ''}`);
  }

  // ── 2. Title & Core Domain Alignment (30% weight) ───────────────────────────
  let titleScore = 0;
  const currentTitle = (candidate.currentTitle || '').toLowerCase();

  if (currentTitle) {
    const candidateTitleWords = currentTitle
      .split(/[\s|/,.-]+/)
      .filter((w) => w.length > 2 && !['and', 'for', 'the', 'with', 'level', 'entry'].includes(w));

    let matchingWordsCount = 0;
    for (const word of candidateTitleWords) {
      if (jobTitle.includes(word)) {
        matchingWordsCount++;
      }
    }

    if (candidateTitleWords.length > 0) {
      const titleMatchRatio = matchingWordsCount / candidateTitleWords.length;
      titleScore = titleMatchRatio * 30;
      if (titleMatchRatio >= 0.5) {
        matchReasons.push(`Title alignment (${candidate.currentTitle})`);
      }
    }
  } else {
    titleScore = 12;
  }

  // Domain Keyword Boost
  const domainKeywords = ['engineer', 'developer', 'designer', 'ai', 'ml', 'frontend', 'backend', 'fullstack', 'data', 'cloud', 'security'];
  let domainMatchCount = 0;
  for (const kw of domainKeywords) {
    if (jobTitle.includes(kw) && (currentTitle.includes(kw) || candidateSkills.some(s => s.toLowerCase().includes(kw)))) {
      domainMatchCount++;
    }
  }
  if (domainMatchCount > 0) {
    titleScore = Math.min(30, titleScore + Math.min(10, domainMatchCount * 4));
  }

  // ── 3. Experience & Seniority Level Alignment (15% weight) ──────────────────
  let seniorityScore = 10;
  const candExp = (candidate.experience || '').toLowerCase();

  const candSeniority = SENIORITY_LEVELS.find((lvl) => currentTitle.includes(lvl) || candExp.includes(lvl)) || 'mid';
  const jobSeniority = SENIORITY_LEVELS.find((lvl) => jobTitle.includes(lvl)) || 'mid';

  if (candSeniority === jobSeniority) {
    seniorityScore = 15;
    matchReasons.push(`Level match (${jobSeniority.toUpperCase()})`);
  } else if (
    (candSeniority === 'fresher' || candSeniority === 'junior' || candSeniority === 'intern') &&
    (jobSeniority === 'principal' || jobSeniority === 'director' || jobSeniority === 'vp' || jobSeniority === 'head')
  ) {
    seniorityScore = 4; // Slight penalty for executive level mismatch
  } else {
    seniorityScore = 12;
  }

  // ── 4. Location & Remote Flexibility (15% weight) ───────────────────────────
  let locationScore = 8;
  const candLoc = (candidate.location || '').toLowerCase();
  const jobLoc = (job.location || '').toLowerCase();

  if (jobLoc.includes('remote') || candLoc.includes('remote')) {
    locationScore = 15;
    matchReasons.push('Remote friendly');
  } else if (candLoc && jobLoc) {
    const candCity = candLoc.split(',')[0].trim();
    if (candCity && (jobLoc.includes(candCity) || candLoc.includes(jobLoc.split(',')[0].trim()))) {
      locationScore = 15;
      matchReasons.push(`Location match (${candCity})`);
    } else {
      locationScore = 10;
    }
  }

  // Calculate final match score normalized between 15% and 98%
  const rawTotal = skillScore + titleScore + seniorityScore + locationScore;
  const matchScore = Math.min(98, Math.max(15, Math.round(rawTotal)));

  return {
    matchScore,
    matchedSkills,
    matchReasons,
  };
}

module.exports = { calculateJobMatch };
