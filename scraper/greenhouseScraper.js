
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { upsertJob } = require('../backend/services/jobService');
const { calculateJobMatch } = require('../backend/services/jobMatcher');

const DEFAULT_PRESET_BOARDS = ['figma', 'stripe', 'discord', 'vercel', 'retool', 'databricks', 'cloudflare', 'openai'];
const MAX_JOBS_PER_BOARD = parseInt(process.env.MAX_JOBS || '10', 10);
const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * Fetch candidate profile for resume-to-job matching.
 */
function getCandidateProfile() {
  try {
    const candidatePath = path.resolve(__dirname, '..', 'data', 'candidate.json');
    if (fs.existsSync(candidatePath)) {
      return JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
    }
  } catch (e) {
    console.warn('[Scraper] Warning loading candidate profile for matching:', e.message);
  }
  return {};
}

/**
 * Fetch a URL and return parsed JSON.
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
function normalizeJob(raw, boardToken, candidateProfile = {}) {
  const location =
    (raw.location && raw.location.name) ||
    (raw.offices && raw.offices[0] && raw.offices[0].location) ||
    'Remote / Not specified';

  const jobUrl = raw.absolute_url || `https://job-boards.greenhouse.io/${boardToken}/jobs/${raw.id}`;
  const applicationUrl = `https://job-boards.greenhouse.io/${boardToken}/jobs/${raw.id}?gh_jid=${raw.id}`;

  const description = raw.content
    ? stripHtml(raw.content).slice(0, 500) + (raw.content.length > 500 ? '...' : '')
    : 'No description available.';

  const companyName = boardToken.charAt(0).toUpperCase() + boardToken.slice(1);

  const normalized = {
    id: `gh_${boardToken}_${raw.id}`,
    title: raw.title || 'Untitled Position',
    company: companyName,
    company_board: boardToken.toLowerCase(),
    location,
    description,
    job_url: jobUrl,
    application_url: applicationUrl,
    source: 'greenhouse',
  };

  // Calculate resume match score
  const { matchScore, matchedSkills } = calculateJobMatch(normalized, candidateProfile);
  normalized.match_score = matchScore;
  normalized.matched_skills = matchedSkills;

  return normalized;
}

/**
 * Scrape a single company board token.
 */
async function scrapeSingleBoard(boardToken, candidateProfile, maxJobs = MAX_JOBS_PER_BOARD) {
  const cleanBoard = boardToken.trim().toLowerCase();
  console.log(`[Scraper] Scraping board: "${cleanBoard}" (max ${maxJobs} jobs)...`);

  const listUrl = `${BASE_URL}/${cleanBoard}/jobs?content=true`;
  let data;
  try {
    data = await fetchJSON(listUrl);
  } catch (err) {
    console.warn(`[Scraper] Could not fetch board "${cleanBoard}": ${err.message}`);
    return { board: cleanBoard, inserted: 0, skipped: 0, total: 0, error: err.message };
  }

  const allJobs = data.jobs || [];
  if (allJobs.length === 0) {
    return { board: cleanBoard, inserted: 0, skipped: 0, total: 0 };
  }

  const selected = selectDiverseJobs(allJobs, maxJobs);
  let inserted = 0;
  let skipped = 0;

  for (const raw of selected) {
    const normalized = normalizeJob(raw, cleanBoard, candidateProfile);
    const { inserted: wasInserted } = upsertJob(normalized);
    if (wasInserted) {
      inserted++;
      console.log(`  ✅ [${normalized.company}] Inserted: "${normalized.title}" (${normalized.match_score}% match)`);
    } else {
      skipped++;
    }
  }

  return { board: cleanBoard, inserted, skipped, total: selected.length };
}

/**
 * Main multi-company scraper function.
 * Accepts string board token, array of board tokens, or defaults to DEFAULT_PRESET_BOARDS.
 */
async function runGreenhouseScraper(boardInput = null) {
  let boardsToScrape = [];

  if (Array.isArray(boardInput) && boardInput.length > 0) {
    boardsToScrape = boardInput;
  } else if (typeof boardInput === 'string' && boardInput.trim()) {
    boardsToScrape = boardInput.split(',').map((b) => b.trim());
  } else {
    const envBoard = process.env.GREENHOUSE_BOARD_TOKEN;
    if (envBoard) {
      boardsToScrape = [envBoard, ...DEFAULT_PRESET_BOARDS.filter((b) => b !== envBoard)];
    } else {
      boardsToScrape = DEFAULT_PRESET_BOARDS;
    }
  }

  // Deduplicate board tokens
  boardsToScrape = Array.from(new Set(boardsToScrape.map((b) => b.toLowerCase().trim()))).filter(Boolean);

  const candidateProfile = getCandidateProfile();
  console.log(`[Scraper] Starting multi-company scraper across ${boardsToScrape.length} boards:`, boardsToScrape.join(', '));

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;
  const boardSummaries = [];

  for (const board of boardsToScrape) {
    const result = await scrapeSingleBoard(board, candidateProfile);
    totalInserted += result.inserted;
    totalSkipped += result.skipped;
    totalProcessed += result.total;
    boardSummaries.push(result);
  }

  const summary = {
    inserted: totalInserted,
    skipped: totalSkipped,
    total: totalProcessed,
    boardsCount: boardsToScrape.length,
    boards: boardSummaries,
  };

  console.log(`[Scraper] Multi-company scraping complete! Total inserted: ${totalInserted}, skipped: ${totalSkipped}`);
  return summary;
}

/**
 * Pick up to `max` jobs with a spread of departments/titles.
 */
function selectDiverseJobs(jobs, max) {
  const shuffled = [...jobs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, max);
}

module.exports = { runGreenhouseScraper, DEFAULT_PRESET_BOARDS };
