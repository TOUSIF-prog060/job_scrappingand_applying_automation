const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');

/**
 * Ensure the screenshots directory exists.
 */
function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

/**
 * Take a full-page screenshot and save it.
 * Returns the relative path (e.g. "screenshots/job_001.png") to store in the DB.
 */
async function captureScreenshot(page, jobId) {
  ensureScreenshotsDir();

  const filename = `${jobId}.png`;
  const absolutePath = path.join(SCREENSHOTS_DIR, filename);
  const relativePath = `screenshots/${filename}`;

  await page.screenshot({
    path: absolutePath,
    fullPage: true,
  });

  console.log(`  [Screenshot] Saved: ${absolutePath}`);
  return relativePath;
}

module.exports = { captureScreenshot };
