const path = require('path');
const fs = require('fs');
const { getJobById } = require('../services/jobService');
const { runApplyForJob, runApplyAll, getApplyAllProgress } = require('../services/applicationService');

async function applyToOne(req, res) {
  try {
    const { jobId } = req.params;
    const { allowSubmit = false } = req.body || {};
    const job = getJobById(jobId);

    if (job.status === 'SCREENSHOT_CAPTURED') {
      return res.json({ message: 'Already completed.', status: job.status });
    }
    if (job.status === 'PROCESSING') {
      return res.json({ message: 'Already in progress.', status: job.status });
    }

    setImmediate(() => runApplyForJob(jobId, { allowSubmit }).catch(console.error));
    res.status(202).json({ message: 'Application started.', status: 'PROCESSING', allowSubmit });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function applyToAll(req, res) {
  try {
    const { allowSubmit = false } = req.body || {};
    const result = await runApplyAll({ allowSubmit });
    if (result.alreadyRunning) {
      return res.status(409).json({ error: 'Apply-all is already running.' });
    }
    res.status(202).json({ ...result, allowSubmit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getStatus(req, res) {
  try {
    const job = getJobById(req.params.jobId);
    res.json({
      id: job.id,
      status: job.status,
      screenshot_path: job.screenshot_path,
      failure_reason: job.failure_reason,
      updated_at: job.updated_at,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function getScreenshot(req, res) {
  try {
    const job = getJobById(req.params.jobId);
    if (!job.screenshot_path) {
      return res.status(404).json({ error: 'No screenshot available for this job.' });
    }

    const screenshotRoot = path.join(__dirname, '..', '..', 'screenshots');
    const filename = path.basename(job.screenshot_path);
    const filePath = path.join(screenshotRoot, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Screenshot file not found on disk.' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.sendFile(filePath);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function applyAllProgress(req, res) {
  try {
    res.json(getApplyAllProgress());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { applyToOne, applyToAll, getStatus, getScreenshot, applyAllProgress };
