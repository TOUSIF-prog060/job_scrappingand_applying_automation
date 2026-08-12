const path = require('path');
const fs = require('fs');
const { getJobById, updateJobStatus, getJobsByStatus } = require('./jobService');
const { applyToJob } = require('../../automation/applyToJob');
const { launchBrowser } = require('../../automation/browserManager');
const { fillVisibleFields } = require('../../automation/formFiller');

// Track apply-all progress in memory
let applyAllProgress = { running: false, total: 0, completed: 0, failed: 0, startedAt: null };

/**
 * Apply to a single job — async (fire and forget from route handler).
 */
async function runApplyForJob(jobId, options = {}) {
  const job = getJobById(jobId);

  if (job.status === 'SCREENSHOT_CAPTURED') {
    return;
  }

  updateJobStatus(jobId, 'PROCESSING');

  try {
    const result = await applyToJob(job, (status, extras) => updateJobStatus(jobId, status, extras), options);
    if (result.success) {
      updateJobStatus(jobId, 'SCREENSHOT_CAPTURED', {
        screenshot_path: result.screenshotPath,
      });
    } else {
      updateJobStatus(jobId, 'FAILED', {
        failure_reason: result.reason || 'Unknown automation failure',
      });
    }
  } catch (err) {
    console.error(`[ApplicationService] Error applying to ${jobId}:`, err.message);
    updateJobStatus(jobId, 'FAILED', {
      failure_reason: `Automation engine error: ${err.message}`,
    });
  }
}

/**
 * Open a live interactive Playwright Chromium window on desktop for a job application,
 * populate all candidate fields (Name, Email, Phone, Resume, Gender, Race, Disability, Veteran, Q&A),
 * bring window to front, and leave the browser window open on screen.
 */
async function openFilledBrowser(jobId) {
  const job = getJobById(jobId);
  const candidatePath = path.resolve(__dirname, '..', '..', 'data', 'candidate.json');
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));

  console.log(`[OpenFilledBrowser] Launching live interactive Chromium window for: "${job.title}"`);
  console.log(`  URL: ${job.application_url}`);

  const { page } = await launchBrowser({ headless: false });
  await page.goto(job.application_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  console.log(`[OpenFilledBrowser] Auto-filling candidate fields in live browser window...`);
  await fillVisibleFields(page, candidate);
  await page.bringToFront().catch(() => {});

  console.log(`[OpenFilledBrowser] Form filled! Browser window remains open on desktop screen.`);

  return { message: 'Filled browser window launched on desktop screen.' };
}

/**
 * Apply to all NOT_STARTED jobs sequentially.
 */
async function runApplyAll(options = {}) {
  if (applyAllProgress.running) {
    return { alreadyRunning: true };
  }

  const jobs = getJobsByStatus('NOT_STARTED');
  if (jobs.length === 0) {
    return { message: 'No NOT_STARTED jobs to process.' };
  }

  applyAllProgress = {
    running: true,
    total: jobs.length,
    completed: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
  };

  (async () => {
    for (const job of jobs) {
      await runApplyForJob(job.id, options);
      const updated = getJobById(job.id);
      if (updated.status === 'SCREENSHOT_CAPTURED') {
        applyAllProgress.completed++;
      } else if (updated.status === 'FAILED') {
        applyAllProgress.failed++;
      }
    }
    applyAllProgress.running = false;
  })();

  return { started: true, total: jobs.length };
}

function getApplyAllProgress() {
  return { ...applyAllProgress };
}

module.exports = { runApplyForJob, runApplyAll, getApplyAllProgress, openFilledBrowser };
