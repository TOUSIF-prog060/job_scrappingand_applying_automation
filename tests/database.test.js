const test = require('node:test');
const assert = require('node:assert/strict');
const { initDb } = require('../backend/db/database');
const { getAllJobs, upsertJob, updateJobStatus, getStats } = require('../backend/services/jobService');

test('database - initializes DB and performs job CRUD operations', async () => {
  await initDb();

  const dummyJob = {
    id: 'gh_test_1001',
    title: 'Test Software Engineer',
    company: 'TestCorp',
    company_board: 'testcorp',
    location: 'Remote',
    description: 'Test job description for integration testing.',
    job_url: 'https://job-boards.greenhouse.io/testcorp/jobs/1001',
    application_url: 'https://job-boards.greenhouse.io/testcorp/jobs/1001?gh_jid=1001',
    source: 'greenhouse',
  };

  // Upsert
  const { inserted } = upsertJob(dummyJob);
  assert.equal(typeof inserted, 'boolean');

  // Query stats
  const stats = getStats();
  assert.ok(stats.total > 0);

  // Update status
  updateJobStatus('gh_test_1001', 'SCREENSHOT_CAPTURED', { screenshot_path: 'screenshots/gh_test_1001.png' });
  const jobs = getAllJobs();
  const found = jobs.find((j) => j.id === 'gh_test_1001');
  assert.ok(found);
  assert.equal(found.status, 'SCREENSHOT_CAPTURED');
  assert.equal(found.screenshot_path, 'screenshots/gh_test_1001.png');
});
