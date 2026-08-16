const path = require('path');
const fs = require('fs');
const { getJobById, updateJobStatus, getJobsByStatus } = require('./jobService');
const { applyToJob } = require('../../automation/applyToJob');

// Track apply-all progress in memory
let applyAllProgress = { running: false, total: 0, completed: 0, failed: 0, manualIntervention: 0, startedAt: null };

/**
 * Apply to a single job — async (fire and forget from route handler).
 */
async function runApplyForJob(jobId, options = {}) {
  const job = getJobById(jobId);

  if (job.status === 'SCREENSHOT_CAPTURED' || job.status === 'READY_FOR_REVIEW') {
    return;
  }

  updateJobStatus(jobId, 'PROCESSING');

  try {
    const result = await applyToJob(job, (status, extras) => updateJobStatus(jobId, status, extras), options);
    if (result.success) {
      updateJobStatus(jobId, 'SCREENSHOT_CAPTURED', {
        screenshot_path: result.screenshotPath,
      });
    } else if (result.captcha) {
      updateJobStatus(jobId, 'MANUAL_INTERVENTION_REQUIRED', {
        screenshot_path: result.screenshotPath,
        failure_reason: result.reason || 'CAPTCHA detected — manual completion required',
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
 * Launch live interactive Playwright Chromium window on user desktop for manual form filling.
 */
async function openLiveInteractiveBrowser(jobId) {
  const { launchBrowser } = require('../../automation/browserManager');
  const { fillVisibleFields } = require('../../automation/formFiller');
  const job = getJobById(jobId);
  const candidatePath = path.resolve(__dirname, '..', '..', 'data', 'candidate.json');
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));

  const targetUrl = job.application_url || job.job_url;
  console.log(`[OpenLiveBrowser] Launching desktop Playwright Chromium window for: "${job.title}"`);
  console.log(`  Target URL: ${targetUrl}`);

  const { page } = await launchBrowser({ headless: false });
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  console.log(`[OpenLiveBrowser] Pre-filling candidate profile fields into live browser...`);
  await fillVisibleFields(page, candidate);
  await page.bringToFront().catch(() => {});

  console.log(`[OpenLiveBrowser] Browser window ready on desktop! You can now manually review or complete remaining fields.`);
  return { success: true, url: targetUrl, jobId };
}

/**
 * Apply to all NOT_STARTED jobs sequentially.
 */
async function runApplyAll(options = {}) {
  if (applyAllProgress.running) {
    return { alreadyRunning: true };
  }

  const { allowSubmit = false, jobIds = [] } = options;
  let jobs = [];

  if (Array.isArray(jobIds) && jobIds.length > 0) {
    const { getAllJobs } = require('./jobService');
    const all = getAllJobs();
    jobs = all.filter((j) => jobIds.includes(j.id) && (j.status === 'NOT_STARTED' || j.status === 'FAILED'));
  } else {
    jobs = getJobsByStatus('NOT_STARTED');
  }

  if (jobs.length === 0) {
    return { message: 'No eligible jobs to process in current filter.', total: 0 };
  }

  applyAllProgress = {
    running: true,
    total: jobs.length,
    completed: 0,
    failed: 0,
    manualIntervention: 0,
    startedAt: new Date().toISOString(),
    cancelRequested: false,
  };

  (async () => {
    for (const job of jobs) {
      if (applyAllProgress.cancelRequested) {
        console.log('[ApplyAll] Stopped before job start by user request.');
        break;
      }
      await runApplyForJob(job.id, { allowSubmit });
      if (applyAllProgress.cancelRequested) {
        console.log('[ApplyAll] Stopped after current job by user request.');
        break;
      }
      const updated = getJobById(job.id);
      if (updated.status === 'SCREENSHOT_CAPTURED' || updated.status === 'READY_FOR_REVIEW') {
        applyAllProgress.completed++;
      } else if (updated.status === 'MANUAL_INTERVENTION_REQUIRED') {
        applyAllProgress.manualIntervention++;
      } else if (updated.status === 'FAILED') {
        applyAllProgress.failed++;
      }
    }
    applyAllProgress.running = false;
    applyAllProgress.cancelRequested = false;
  })();

  return { started: true, total: jobs.length };
}

function stopApplyAll() {
  if (applyAllProgress.running) {
    applyAllProgress.cancelRequested = true;
    applyAllProgress.running = false;
    console.log('[ApplicationService] Stop apply-all requested by user.');
    return { success: true, message: 'Apply-all cancellation requested.' };
  }
  return { success: true, message: 'Apply-all was not running.' };
}

function getApplyAllProgress() {
  return { ...applyAllProgress };
}

module.exports = {
  runApplyForJob,
  openLiveInteractiveBrowser,
  runApplyAll,
  stopApplyAll,
  getApplyAllProgress,
};
