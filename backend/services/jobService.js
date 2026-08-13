const { queryAll, queryOne, run } = require('../db/database');
const { calculateJobMatch } = require('./jobMatcher');

const VALID_STATUSES = [
  'NOT_STARTED',
  'PROCESSING',
  'FORM_FILLED',
  'READY_FOR_SUBMISSION',
  'SCREENSHOT_CAPTURED',
  'FAILED',
];

function formatJobRecord(job) {
  if (!job) return null;
  let matchedSkills = [];
  if (job.matched_skills) {
    try {
      matchedSkills = typeof job.matched_skills === 'string' ? JSON.parse(job.matched_skills) : job.matched_skills;
    } catch (_) {
      matchedSkills = [];
    }
  }
  return {
    ...job,
    match_score: Number(job.match_score || 0),
    matched_skills: matchedSkills,
  };
}

function getAllJobs() {
  const rows = queryAll('SELECT * FROM jobs ORDER BY match_score DESC, created_at DESC');
  return rows.map(formatJobRecord);
}

function getJobById(id) {
  const job = queryOne('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) {
    const err = new Error(`Job not found: ${id}`);
    err.status = 404;
    throw err;
  }
  return formatJobRecord(job);
}

function upsertJob(jobData) {
  const existing = queryOne('SELECT * FROM jobs WHERE job_url = ?', [jobData.job_url]);

  const matchedSkillsJson = Array.isArray(jobData.matched_skills)
    ? JSON.stringify(jobData.matched_skills)
    : (jobData.matched_skills || '[]');

  if (existing) {
    // Update match score if newer calculation provided
    if (jobData.match_score !== undefined) {
      run(
        `UPDATE jobs SET match_score = ?, matched_skills = ? WHERE id = ?`,
        [jobData.match_score || 0, matchedSkillsJson, existing.id]
      );
    }
    return { inserted: false, job: getJobById(existing.id) };
  }

  run(
    `INSERT INTO jobs (id, title, company, company_board, location, description, job_url, application_url, source, status, match_score, matched_skills)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', ?, ?)`,
    [
      jobData.id,
      jobData.title,
      jobData.company,
      jobData.company_board || jobData.company,
      jobData.location,
      jobData.description,
      jobData.job_url,
      jobData.application_url,
      jobData.source || 'greenhouse',
      jobData.match_score || 0,
      matchedSkillsJson,
    ]
  );
  const job = getJobById(jobData.id);
  return { inserted: true, job };
}

function updateJobStatus(id, status, extras = {}) {
  if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
  const { screenshot_path = null, failure_reason = null } = extras;
  run(
    `UPDATE jobs SET status = ?, screenshot_path = COALESCE(?, screenshot_path),
     failure_reason = COALESCE(?, failure_reason), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, screenshot_path, failure_reason, id]
  );
  return getJobById(id);
}

function getJobsByStatus(status) {
  const rows = queryAll('SELECT * FROM jobs WHERE status = ?', [status]);
  return rows.map(formatJobRecord);
}

function clearAllJobs() {
  run('DELETE FROM jobs');
}

function recalculateAllMatchScores(candidateProfile) {
  if (!candidateProfile) return;
  const jobs = queryAll('SELECT * FROM jobs');
  for (const j of jobs) {
    const { matchScore, matchedSkills } = calculateJobMatch(j, candidateProfile);
    run(
      `UPDATE jobs SET match_score = ?, matched_skills = ? WHERE id = ?`,
      [matchScore, JSON.stringify(matchedSkills), j.id]
    );
  }
  console.log(`[JobService] Recalculated match scores for ${jobs.length} jobs.`);
}

function getStats() {
  const rows = queryAll('SELECT status, COUNT(*) as count FROM jobs GROUP BY status');
  const stats = { total: 0, not_started: 0, processing: 0, completed: 0, failed: 0 };
  rows.forEach(({ status, count }) => {
    const c = Number(count);
    stats.total += c;
    if (status === 'NOT_STARTED') stats.not_started += c;
    else if (['PROCESSING', 'FORM_FILLED', 'READY_FOR_SUBMISSION'].includes(status)) stats.processing += c;
    else if (status === 'SCREENSHOT_CAPTURED') stats.completed += c;
    else if (status === 'FAILED') stats.failed += c;
  });
  return stats;
}

module.exports = {
  getAllJobs,
  getJobById,
  upsertJob,
  updateJobStatus,
  getJobsByStatus,
  clearAllJobs,
  recalculateAllMatchScores,
  getStats,
};
