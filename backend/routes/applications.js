const express = require('express');
const router = express.Router();
const {
  applyToOne,
  openBrowserHandler,
  applyToAll,
  getStatus,
  getScreenshot,
  applyAllProgress,
} = require('../controllers/applicationController');

// POST /api/applications/:jobId/apply — apply to one job (async)
router.post('/:jobId/apply', applyToOne);

// POST /api/applications/:jobId/open-browser — launch live pre-filled Chromium window
router.post('/:jobId/open-browser', openBrowserHandler);

// POST /api/applications/apply-all — apply to all NOT_STARTED (async)
router.post('/apply-all', applyToAll);

// GET /api/applications/progress — get apply-all progress
router.get('/progress', applyAllProgress);

// GET /api/applications/:jobId/status — poll one job's status
router.get('/:jobId/status', getStatus);

// GET /api/applications/:jobId/screenshot — serve the proof screenshot
router.get('/:jobId/screenshot', getScreenshot);

module.exports = router;
