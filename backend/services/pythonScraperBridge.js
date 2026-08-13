const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { upsertJob } = require('./jobService');
const { calculateJobMatch } = require('./jobMatcher');

const PYTHON_VENV_EXE = path.resolve(__dirname, '..', '..', 'python_scraper', '.venv', 'Scripts', 'python.exe');
const SCRAPER_PY = path.resolve(__dirname, '..', '..', 'python_scraper', 'scraper.py');
const CANDIDATE_PATH = path.resolve(__dirname, '..', '..', 'data', 'candidate.json');

function getCandidateProfile() {
  try {
    if (fs.existsSync(CANDIDATE_PATH)) {
      return JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
    }
  } catch (_) {}
  return {};
}

/**
 * Execute Python scraper via subprocess and ingest results into SQLite database.
 * 
 * @param {string[]|string} boards - Board tokens array or string
 * @param {number} maxPerBoard - Max jobs per board
 * @returns {Promise<Object>} Summary object
 */
async function runPythonScraper(boards = null, maxPerBoard = 10) {
  return new Promise((resolve, reject) => {
    let boardArg = '';
    if (Array.isArray(boards) && boards.length > 0) {
      boardArg = boards.join(',');
    } else if (typeof boards === 'string' && boards.trim()) {
      boardArg = boards;
    }

    const pythonExe = fs.existsSync(PYTHON_VENV_EXE) ? PYTHON_VENV_EXE : 'python';
    const args = [SCRAPER_PY];

    if (boardArg) {
      args.push(`--boards=${boardArg}`);
    }
    if (maxPerBoard) {
      args.push(`--max=${maxPerBoard}`);
    }

    console.log(`[PythonScraperBridge] Executing: ${pythonExe} ${args.join(' ')}`);

    execFile(pythonExe, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[PythonScraperBridge] Python stderr:', stderr);
        return reject(new Error(`Python scraper failed: ${error.message}`));
      }

      try {
        const data = JSON.parse(stdout);
        const jobs = data.jobs || [];
        const candidate = getCandidateProfile();

        let insertedCount = 0;
        let skippedCount = 0;

        for (const rawJob of jobs) {
          // Calculate match score
          const { matchScore, matchedSkills } = calculateJobMatch(rawJob, candidate);
          const jobWithMatch = {
            ...rawJob,
            match_score: matchScore,
            matched_skills: matchedSkills,
          };

          const { inserted } = upsertJob(jobWithMatch);
          if (inserted) {
            insertedCount++;
            console.log(`  ✅ [PythonBridge] Inserted: "${rawJob.title}" (${matchScore}% match)`);
          } else {
            skippedCount++;
          }
        }

        const summary = {
          success: true,
          engine: 'python',
          inserted: insertedCount,
          skipped: skippedCount,
          totalScraped: data.total_jobs || jobs.length,
          boardsCount: data.boards_count || (boards ? boards.length : 8),
        };

        console.log('[PythonScraperBridge] Done:', summary);
        resolve(summary);
      } catch (err) {
        reject(new Error(`Failed to parse Python scraper output: ${err.message}`));
      }
    });
  });
}

module.exports = { runPythonScraper };
