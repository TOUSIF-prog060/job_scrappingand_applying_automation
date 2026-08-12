require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { upsertJob } = require('../backend/services/jobService');

const BOARD_TOKEN = process.env.GREENHOUSE_BOARD_TOKEN || 'notion';
const MAX_JOBS = parseInt(process.env.MAX_JOBS || '15', 10);
const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * Fetch a URL and return parsed JSON.
 * Uses native fetch (Node 18+).
 */
async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobBot/1.0)' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

/**
 * Strip HTML tags from a string, decode entities, and trim.
 */
function stripHtml(html = '') {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a raw Greenhouse job object into our Job record schema.
 */
function normalizeJob(raw, boardToken) {
  const location =
    (raw.location && raw.location.name) ||
    (raw.offices && raw.offices[0] && raw.offices[0].location) ||
    'Remote / Not specified';

  const jobUrl = raw.absolute_url || `https://job-boards.greenhouse.io/${boardToken}/jobs/${raw.id}`;
  // Application URL points to the direct job board page with form
  const applicationUrl = `https://job-boards.greenhouse.io/${boardToken}/jobs/${raw.id}?gh_jid=${raw.id}`;

  const description = raw.content
    ? stripHtml(raw.content).slice(0, 500) + (raw.content.length > 500 ? '...' : '')
    : 'No description available.';

  return {
    id: `gh_${raw.id}`,
    title: raw.title || 'Untitled Position',
    company: boardToken.charAt(0).toUpperCase() + boardToken.slice(1), // capitalize board token
    location,
    description,
    job_url: jobUrl,
    application_url: applicationUrl,
    source: 'greenhouse',
  };
}

/**
 * Main scraper function.
 * Fetches jobs from Greenhouse API, normalizes them, and saves to DB.
 */
async function runGreenhouseScraper(boardToken = BOARD_TOKEN) {
  console.log(`[Scraper] Starting — board: ${boardToken}, max: ${MAX_JOBS}`);

  // Step 1: Get the job listing
  const listUrl = `${BASE_URL}/${boardToken}/jobs?content=true`;
  let data;
  try {
    data = await fetchJSON(listUrl);
  } catch (err) {
    throw new Error(`[Scraper] Failed to fetch job list: ${err.message}`);
  }

  const allJobs = data.jobs || [];
  console.log(`[Scraper] Found ${allJobs.length} total jobs from Greenhouse.`);

  if (allJobs.length === 0) {
    return { inserted: 0, skipped: 0, total: 0 };
  }

  // Step 2: Pick a diverse spread (not just the first N)
  const selected = selectDiverseJobs(allJobs, MAX_JOBS);
  console.log(`[Scraper] Selected ${selected.length} jobs to import.`);

  // Step 3: Normalize + dedup + insert
  let inserted = 0;
  let skipped = 0;

  for (const raw of selected) {
    const normalized = normalizeJob(raw, boardToken);
    const { inserted: wasInserted } = upsertJob(normalized);
    if (wasInserted) {
      inserted++;
      console.log(`  ✅ Inserted: ${normalized.title} (${normalized.location})`);
    } else {
      skipped++;
      console.log(`  ⏭️  Skipped (duplicate): ${normalized.title}`);
    }
  }

  const summary = { inserted, skipped, total: selected.length, board: boardToken };
  console.log(`[Scraper] Done. ${JSON.stringify(summary)}`);
  return summary;
}

/**
 * Pick up to `max` jobs with a spread of departments/titles.
 * Simple approach: shuffle and take first N.
 */
function selectDiverseJobs(jobs, max) {
  // Shuffle
  const shuffled = [...jobs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, max);
}

module.exports = { runGreenhouseScraper };
