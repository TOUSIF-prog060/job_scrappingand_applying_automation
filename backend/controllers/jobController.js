const { getAllJobs, getJobById, getStats } = require('../services/jobService');
const { runGreenhouseScraper } = require('../../scraper/greenhouseScraper');
const { runPythonScraper } = require('../services/pythonScraperBridge');

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
    const { boards } = req.body || {};
    console.log(`[ScraperController] Scrape requested for boards:`, boards || 'default');

    let result;
    try {
      result = await runPythonScraper(boards);
      console.log('[ScraperController] Python scraper completed:', result);
    } catch (e) {
      console.warn('[ScraperController] Python scraper failed, triggering JS fallback:', e.message);
      result = await runGreenhouseScraper(boards);
      console.log('[ScraperController] JS Fallback completed:', result);
    }

    res.json(result || { success: true, message: 'Scrape completed', inserted: 0 });
  } catch (err) {
    console.error('[ScraperController] Scrape error:', err.message);
    res.status(200).json({ success: false, error: err.message, inserted: 0, totalScraped: 0 });
  }
}

module.exports = { listJobs, getJob, scrapeJobs };
