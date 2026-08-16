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

  // When the form is inside an embedded iframe, a fullPage capture renders it blank,
  // so shoot the iframe element itself to get usable proof of the filled fields.
  const embedded = await getEmbeddedFormElement(page);
  if (embedded) {
    await embedded.scrollIntoViewIfNeeded().catch(() => {});
    await embedded.screenshot({ path: absolutePath });
    console.log(`  [Screenshot] Saved embedded form frame: ${absolutePath}`);
    return relativePath;
  }

  await page.screenshot({
    path: absolutePath,
    fullPage: true,
  });

  console.log(`  [Screenshot] Saved: ${absolutePath}`);
  return relativePath;
}

/**
 * Return the <iframe> element hosting the application form, or null if the form
 * is in the main frame.
 */
async function getEmbeddedFormElement(page) {
  try {
    const { resolveFormContext } = require('./formFiller');
    const ctx = await resolveFormContext(page);
    if (!ctx || typeof ctx.frameElement !== 'function') return null;
    if (typeof page.mainFrame === 'function' && ctx === page.mainFrame()) return null;
    return await ctx.frameElement().catch(() => null);
  } catch (_) {
    return null;
  }
}

module.exports = { captureScreenshot };
