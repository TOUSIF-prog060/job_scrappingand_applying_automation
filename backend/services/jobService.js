const { queryAll, queryOne, run } = require('../db/database');

const VALID_STATUSES = [
  'NOT_STARTED',
  'PROCESSING',
  'FORM_FILLED',
  'READY_FOR_SUBMISSION',
  'SCREENSHOT_CAPTURED',
  'FAILED',
];

function getAllJobs() {
  return queryAll('SELECT * FROM jobs ORDER BY created_at DESC');
}

function getJobById(id) {
  const job = queryOne('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) {
    const err = new Error(`Job not found: ${id}`);
    err.status = 404;
    throw err;
  }
  return job;
}

function upsertJob(jobData) {
  const existing = queryOne('SELECT * FROM jobs WHERE job_url = ?', [jobData.job_url]);
  if (existing) return { inserted: false, job: existing };

  run(
    `INSERT INTO jobs (id, title, company, location, description, job_url, application_url, source, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED')`,
    [jobData.id, jobData.title, jobData.company, jobData.location, jobData.description,
     jobData.job_url, jobData.application_url, jobData.source]
  );
  const job = queryOne('SELECT * FROM jobs WHERE id = ?', [jobData.id]);
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
  return queryAll('SELECT * FROM jobs WHERE status = ?', [status]);
}

function clearAllJobs() {
  run('DELETE FROM jobs');
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

module.exports = { getAllJobs, getJobById, upsertJob, updateJobStatus, getJobsByStatus, clearAllJobs, getStats };
