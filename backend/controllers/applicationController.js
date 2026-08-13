const path = require('path');
const fs = require('fs');
const { getJobById } = require('../services/jobService');
const {
  runApplyForJob,
  runApplyAll,
  getApplyAllProgress,
} = require('../services/applicationService');

async function applyToOne(req, res) {
  try {
    const { jobId } = req.params;
    const { allowSubmit = false } = req.body || {};
    const job = getJobById(jobId);

    if (job.status === 'SCREENSHOT_CAPTURED' || job.status === 'READY_FOR_REVIEW') {
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
    const { allowSubmit = false, jobIds = [] } = req.body || {};
    const result = await runApplyAll({ allowSubmit, jobIds });
    if (result.alreadyRunning) {
      return res.status(409).json({ error: 'Apply-all is already running.' });
    }
    res.status(202).json({ ...result, allowSubmit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function stopApplyAllController(req, res) {
  try {
    const { stopApplyAll } = require('../services/applicationService');
    const result = stopApplyAll();
    res.json(result);
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
    const { jobId } = req.params;
    const screenshotRoot = path.join(__dirname, '..', '..', 'screenshots');

    let filePath = null;
    const job = getJobById(jobId);
    if (job && job.screenshot_path) {
      const filename = path.basename(job.screenshot_path);
      const target = path.join(screenshotRoot, filename);
      if (fs.existsSync(target)) filePath = target;
    }

    if (!filePath) {
      const possibleFiles = [
        `${jobId}.png`,
        `${jobId}_proof.png`,
        `${jobId}_final.png`,
        `${jobId}.jpg`
      ];
      for (const fname of possibleFiles) {
        const candidatePath = path.join(screenshotRoot, fname);
        if (fs.existsSync(candidatePath)) {
          filePath = candidatePath;
          break;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
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

module.exports = {
  applyToOne,
  applyToAll,
  stopApplyAllController,
  getStatus,
  getScreenshot,
  applyAllProgress,
};
