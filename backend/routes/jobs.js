const express = require('express');
const router = express.Router();
const { listJobs, getJob, scrapeJobs } = require('../controllers/jobController');

// GET /api/jobs — list all jobs
router.get('/', listJobs);

// POST /api/jobs/scrape — trigger the scraper
router.post('/scrape', scrapeJobs);

// GET /api/jobs/:id — get one job
router.get('/:id', getJob);

module.exports = router;
