const { chromium } = require('playwright');

// Default to HEADLESS = false (Headed mode) so the user can see the browser window fill out the form
const HEADLESS = process.env.HEADLESS === 'true';

/**
 * Launch a new browser context (isolated profile).
 * Returns { browser, context, page }.
 */
async function launchBrowser(options = {}) {
  const isHeadless = options.headless !== undefined ? options.headless : HEADLESS;

  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    slowMo: isHeadless ? 0 : 100, // 100ms typing delay in headed mode so user sees form filling
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  return { browser, context, page };
}

/**
 * Cleanly close browser.
 */
async function closeBrowser(browser) {
  try {
    if (browser) await browser.close();
  } catch (_) {}
}

module.exports = { launchBrowser, closeBrowser };
