const { chromium } = require('playwright');

const HEADLESS = process.env.HEADLESS !== 'false'; // default headless, set HEADLESS=false to see browser

/**
 * Launch a new browser context (isolated profile — no cookie bleed between runs).
 * Returns { browser, context, page }.
 */
async function launchBrowser() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // reduce bot-detection signals
    ],
    slowMo: HEADLESS ? 0 : 50, // slight delay in headed mode to watch it work
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
 * Cleanly close browser and context, ignoring errors (the browser may already be gone).
 */
async function closeBrowser(browser) {
  try {
    if (browser) await browser.close();
  } catch (_) {
    // ignore
  }
}

module.exports = { launchBrowser, closeBrowser };
