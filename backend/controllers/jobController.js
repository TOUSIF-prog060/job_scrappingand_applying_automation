const { getAllJobs, getJobById, getStats } = require('../services/jobService');
const { runGreenhouseScraper } = require('../../scraper/greenhouseScraper');

async function listJobs(req, res) {
  try {
    const jobs = getAllJobs();
    res.json({ jobs, stats: getStats() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getJob(req, res) {
  try {
    const job = getJobById(req.params.id);
    res.json(job);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function scrapeJobs(req, res) {
  try {
    // Respond immediately, scrape runs quickly (it's just HTTP + DB writes)
    res.json({ message: 'Scraping started...', status: 'running' });
    // Run after response is sent
    setImmediate(async () => {
      try {
        const result = await runGreenhouseScraper();
        console.log('[Scraper] Done:', result);
      } catch (e) {
        console.error('[Scraper] Error:', e.message);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listJobs, getJob, scrapeJobs };
