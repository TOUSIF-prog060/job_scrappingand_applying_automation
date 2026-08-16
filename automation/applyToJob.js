require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');

const { launchBrowser, closeBrowser } = require('./browserManager');
const {
  fillVisibleFields,
  validateFilledForm,
  detectCaptcha,
  clickContinueIfPresent,
  clickApplyEntryIfPresent,
  waitForFormFields,
  clickSubmit,
  isOnReviewPage,
  isSubmittedConfirmationPage,
} = require('./formFiller');
const { captureScreenshot } = require('./screenshotCapture');

const CANDIDATE_PATH = path.resolve(__dirname, '..', 'data', 'candidate.json');

function loadCandidate() {
  return JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
}

/**
 * Main per-job automation function.
 *
 * @param {Object} job — a job record from the database
 * @param {Function} [onStatusUpdate] — status progress callback
 * @param {Object} [options] — options object: { allowSubmit?: boolean, keepOpen?: boolean }
 * @returns {{ success: boolean, screenshotPath?: string, reason?: string }}
 */
async function applyToJob(job, onStatusUpdate = () => { }, options = {}) {
  const candidate = loadCandidate();
  const allowSubmit = options.allowSubmit || process.env.ENABLE_REAL_SUBMIT === 'true';
  const keepOpen = options.keepOpen === true || process.env.KEEP_BROWSER_OPEN === 'true';
  let browser = null;

  console.log(`\n[ApplyToJob] Starting: "${job.title}" (${job.id})`);
  console.log(`  URL: ${job.application_url}`);
  console.log(`  Mode: ${allowSubmit ? '⚡ REAL SUBMISSION ENABLED' : '🛡️ PRE-SUBMISSION PROOF ONLY'}`);

  try {
    // Step 1: Launch browser (visible Chromium window on desktop)
    onStatusUpdate('PROCESSING');
    const { browser: b, page } = await launchBrowser({ headless: false });
    browser = b;

    // Step 2: Navigate to application URL
    console.log(`  [Step 1] Navigating to ${job.application_url}...`);
    await page.goto(job.application_url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await page.waitForTimeout(2000);
    await waitForFormFields(page, 8_000);

    // Step 3: Check for CAPTCHA immediately
    if (await detectCaptcha(page)) {
      const screenshotPath = await captureScreenshot(page, job.id).catch(() => null);
      if (!keepOpen) await closeBrowser(browser);
      return {
        success: false,
        captcha: true,
        reason: 'CAPTCHA or bot protection detected',
        screenshotPath,
      };
    }

    // Step 4: Multi-step form filling loop
    let stepCount = 0;
    const MAX_STEPS = 10;
    let lastFillResult = null;

    while (stepCount < MAX_STEPS) {
      stepCount++;
      console.log(`  [Step ${stepCount}] Filling form fields...`);

      lastFillResult = await fillVisibleFields(page, candidate);
      onStatusUpdate('FORM_FILLED');

      await page.waitForTimeout(1000);

      // Some boards (e.g. Databricks) redirect to a landing page whose form sits behind
      // an "Apply" button. Only follow it while nothing has been filled, so this can never
      // fire on a completed form where "Apply" would mean submit.
      if (lastFillResult.filled === 0 && (await clickApplyEntryIfPresent(page))) {
        await waitForFormFields(page, 15_000);
        continue;
      }

      // Check if review/ready page reached
      if (await isOnReviewPage(page)) {
        console.log(`  [Step ${stepCount}] Review/submit page detected.`);
        onStatusUpdate('READY_FOR_SUBMISSION');
        break;
      }

      // Try to click Continue button if multi-page
      const clicked = await clickContinueIfPresent(page);
      if (!clicked) {
        console.log(`  [Step ${stepCount}] Form ready for submission.`);
        onStatusUpdate('READY_FOR_SUBMISSION');
        break;
      }

      await page.waitForTimeout(2000);

      if (await detectCaptcha(page)) {
        const screenshotPath = await captureScreenshot(page, job.id).catch(() => null);
        if (!keepOpen) await closeBrowser(browser);
        return {
          success: false,
          captcha: true,
          reason: 'CAPTCHA detected after navigation',
          screenshotPath,
        };
      }
    }

    // Nothing filled means we never reached a real application form — reporting success
    // here would produce a proof screenshot of an empty page.
    if (!lastFillResult || lastFillResult.filled === 0) {
      console.warn(`  [Validation Failed] No form fields were filled on this page.`);
      const screenshotPath = await captureScreenshot(page, `${job.id}_failed`).catch(() => null);
      if (!keepOpen) await closeBrowser(browser);
      return {
        success: false,
        reason: 'No application form fields were found or filled on this page',
        screenshotPath,
      };
    }

    // Validate form completion before declaring success
    const validation = await validateFilledForm(page);
    if (!validation.valid) {
      console.warn(`  [Validation Failed] Required fields missing: ${validation.missingFields.join(', ')}`);
      const screenshotPath = await captureScreenshot(page, `${job.id}_failed`).catch(() => null);
      if (!keepOpen) await closeBrowser(browser);
      return {
        success: false,
        reason: `Required form fields could not be filled (${validation.missingFields.join(', ')})`,
        screenshotPath,
      };
    }

    // Step 5: Real submission (if enabled) OR pre-submission proof
    if (allowSubmit) {
      console.log(`  [Submit] Real submission mode active — clicking Submit Application...`);
      const submitted = await clickSubmit(page);
      if (submitted) {
        console.log(`  [Submit] Waiting for confirmation screen...`);
        await page.waitForTimeout(4000);
        const confirmed = await isSubmittedConfirmationPage(page);
        console.log(`  [Submit] Confirmation status: ${confirmed ? 'Confirmed ✓' : 'Submitted'}`);
      }
    } else {
      console.log(`  [Safety] Form filled! Stopping before submission (pre-submission proof mode).`);
    }

    // Step 6: Capture proof screenshot
    console.log(`  [Final] Capturing screenshot...`);
    const screenshotPath = await captureScreenshot(page, job.id);

    // Keep browser window open on user's desktop for inspection & manual submission
    if (keepOpen) {
      console.log(`\n  🖥️  [LIVE BROWSER OPEN] Form filled successfully!`);
      console.log(`      The Playwright browser window is open on your desktop screen.`);
      console.log(`      You can review all filled fields, make any edits, and submit directly.\n`);
    } else {
      await closeBrowser(browser);
      browser = null;
    }

    return { success: true, screenshotPath };
  } catch (err) {
    console.error(`  [ApplyToJob] Error:`, err.message);

    let errScreenshotPath = null;
    if (browser) {
      try {
        const pages = browser.contexts()[0]?.pages() || [];
        if (pages.length > 0) {
          errScreenshotPath = await captureScreenshot(pages[0], `${job.id}_error`).catch(() => null);
        }
      } catch (_) { }
      if (!keepOpen) await closeBrowser(browser);
    }

    return {
      success: false,
      reason: mapErrorToReason(err),
      screenshotPath: errScreenshotPath,
    };
  }
}

function mapErrorToReason(err) {
  const msg = err.message || '';
  if (msg.includes('net::ERR') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
    return 'Job posting no longer accessible (network error)';
  }
  if (msg.includes('timeout') || msg.includes('Timeout')) {
    return 'Page took too long to load';
  }
  if (msg.includes('navigation')) {
    return 'Page redirected unexpectedly';
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return 'Job posting no longer exists (404)';
  }
  return `Automation engine error: ${msg.slice(0, 200)}`;
}

module.exports = { applyToJob };
