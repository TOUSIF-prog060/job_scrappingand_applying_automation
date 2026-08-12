const path = require('path');
const fs = require('fs');
const { findMatchingKey, getCandidateValue } = require('./fieldMapper');

/**
 * Safety guard — check if button is safe to click (for non-submit steps).
 */
function isSafeToClick(buttonText = '') {
  const FORBIDDEN = ['submit application', 'submit', 'send application', 'send your application'];
  const lower = buttonText.toLowerCase().trim();
  return !FORBIDDEN.some((phrase) => lower.includes(phrase));
}

/**
 * Known direct Greenhouse field mappings by selector.
 */
const GREENHOUSE_DIRECT_FIELDS = [
  { selector: '#first_name, input[name="job_application[first_name]"], input[id*="first_name"]', key: 'firstName' },
  { selector: '#last_name, input[name="job_application[last_name]"], input[id*="last_name"]', key: 'lastName' },
  { selector: '#email, input[name="job_application[email]"], input[id*="email"]', key: 'email' },
  { selector: '#phone, input[name="job_application[phone]"], input[id*="phone"]', key: 'phone' },
  { selector: '#location, input[name="job_application[location]"], input[id*="location"]', key: 'location' },
  { selector: 'input[name*="linkedin"], input[id*="linkedin"]', key: 'linkedin' },
  { selector: 'input[name*="github"], input[id*="github"]', key: 'github' },
  { selector: 'input[name*="website"], input[id*="website"], input[name*="portfolio"]', key: 'website' },
];

/**
 * Known direct Greenhouse EEO & demographic dropdown selectors.
 */
const GREENHOUSE_EEO_SELECTS = [
  { selector: '#gender, select[name*="gender"], select[id*="gender"]', key: 'gender' },
  { selector: '#race, #ethnicity, select[name*="race"], select[name*="ethnicity"], select[id*="race"]', key: 'ethnicity' },
  { selector: '#veteran_status, select[name*="veteran"], select[id*="veteran"]', key: 'veteranStatus' },
  { selector: '#disability_status, select[name*="disability"], select[id*="disability"]', key: 'disabilityStatus' },
  { selector: 'select[name*="authorized"], select[name*="authorization"], select[id*="authorized"]', key: 'workAuthorization' },
  { selector: 'select[name*="sponsorship"], select[name*="visa"], select[id*="sponsorship"]', key: 'requiresSponsorship' },
];

/**
 * Detect and fill all visible form fields on the current page.
 * Returns { filled: number, skipped: string[] } — filled count and skipped labels.
 */
async function fillVisibleFields(page, candidate) {
  const filled = [];
  const skipped = [];

  // 1. Direct Greenhouse Known Input IDs Fill
  for (const item of GREENHOUSE_DIRECT_FIELDS) {
    const value = getCandidateValue(candidate, item.key);
    if (!value) continue;

    try {
      const el = await page.$(item.selector);
      if (el && (await el.isVisible())) {
        await el.scrollIntoViewIfNeeded();
        await el.fill(value);
        filled.push(item.key);
      }
    } catch (_) {}
  }

  // 2. Direct Greenhouse EEO & Demographic Dropdowns
  for (const item of GREENHOUSE_EEO_SELECTS) {
    const value = getCandidateValue(candidate, item.key);
    if (!value) continue;

    try {
      const sel = await page.$(item.selector);
      if (sel && (await sel.isVisible())) {
        await sel.scrollIntoViewIfNeeded();
        const options = await sel.$$eval('option', (opts) =>
          opts.map((o) => ({ value: o.value, text: o.textContent.trim() }))
        );
        const best = options.find(
          (o) =>
            o.text.toLowerCase().includes(value.toLowerCase()) ||
            (o.value && o.value.toLowerCase().includes(value.toLowerCase()))
        );
        if (best) {
          await sel.selectOption({ value: best.value });
          filled.push(`EEO: ${item.key}`);
        }
      }
    } catch (_) {}
  }

  // 3. Generic Text / Email / Tel / URL / Number inputs
  const inputs = await page.$$(
    'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])'
  );
  for (const input of inputs) {
    try {
      const currentValue = await input.inputValue();
      if (currentValue && currentValue.trim().length > 0) continue;

      const label = await getLabelForElement(page, input);
      if (!label) continue;

      const match = findMatchingKey(label);
      if (!match) {
        skipped.push(label);
        continue;
      }

      const value = getCandidateValue(candidate, match.key);
      if (!value) continue;

      await input.scrollIntoViewIfNeeded();
      await input.fill(value);
      filled.push(label);
    } catch (e) {
      skipped.push(`Input fill error: ${e.message}`);
    }
  }

  // 4. Textareas & Essay Questions
  const textareas = await page.$$('textarea');
  for (const ta of textareas) {
    try {
      const currentValue = await ta.inputValue();
      if (currentValue && currentValue.trim().length > 0) continue;

      const label = await getLabelForElement(page, ta);
      let value = '';

      if (label) {
        const match = findMatchingKey(label);
        if (match) value = getCandidateValue(candidate, match.key);
      }

      // Fallback for custom question textareas if unmapped
      if (!value) {
        value = candidate.coverLetter || candidate.experience || 'N/A';
      }

      await ta.scrollIntoViewIfNeeded();
      await ta.fill(value);
      filled.push(label || 'Custom Text Question');
    } catch (e) {
      skipped.push(`Textarea fill error: ${e.message}`);
    }
  }

  // 5. Generic Selects (Dropdowns)
  const selects = await page.$$('select');
  for (const sel of selects) {
    try {
      const currentVal = await sel.evaluate((s) => s.value);
      const label = await getLabelForElement(page, sel);
      if (!label) continue;

      const match = findMatchingKey(label);
      let value = match ? getCandidateValue(candidate, match.key) : '';

      const options = await sel.$$eval('option', (opts) =>
        opts.map((o) => ({ value: o.value, text: o.textContent.trim() }))
      );

      if (value) {
        const best = options.find(
          (o) =>
            o.text.toLowerCase().includes(value.toLowerCase()) ||
            (o.value && o.value.toLowerCase().includes(value.toLowerCase()))
        );
        if (best) {
          await sel.selectOption({ value: best.value });
          filled.push(label);
          continue;
        }
      }

      // If required dropdown is still default/empty, select first non-empty option
      if (!currentVal || currentVal === '' || currentVal === '-1') {
        const validOpt = options.find((o) => o.value !== '' && o.value !== '-1' && !o.text.toLowerCase().includes('select'));
        if (validOpt) {
          await sel.selectOption({ value: validOpt.value });
          filled.push(`${label} (auto-selected option)`);
        }
      }
    } catch (e) {
      skipped.push(`Select error: ${e.message}`);
    }
  }

  // 6. File inputs — resume upload
  const fileInputs = await page.$$('input[type="file"]');
  for (const fi of fileInputs) {
    try {
      const resumeAbsPath = path.resolve(__dirname, '..', candidate.resumePath || './data/resume.pdf');
      if (fs.existsSync(resumeAbsPath)) {
        await fi.setInputFiles(resumeAbsPath);
        filled.push('resume upload');
      } else {
        skipped.push('resume upload (file not found)');
      }
    } catch (e) {
      skipped.push(`resume upload error: ${e.message}`);
    }
  }

  console.log(`  [FormFiller] Filled: ${filled.length} fields | Skipped: ${skipped.length}`);
  return { filled: filled.length, skipped };
}

/**
 * Try to find the human-readable label for a form element.
 */
async function getLabelForElement(page, element) {
  try {
    const ariaLabel = await element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const id = await element.getAttribute('id');
    if (id) {
      const labelEl = await page.$(`label[for="${id}"]`);
      if (labelEl) {
        const text = await labelEl.innerText();
        if (text && text.trim()) return text.trim();
      }
    }

    const placeholder = await element.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) return placeholder.trim();

    const name = await element.getAttribute('name');
    if (name && name.trim()) return name.trim();

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Detect if the current page has active CAPTCHA / bot protection challenge.
 */
async function detectCaptcha(page) {
  try {
    const activeCaptchaSelectors = [
      'iframe[src*="recaptcha/api2/bframe"]',
      'iframe[src*="hcaptcha.com/captcha"]',
      'iframe[src*="challenges.cloudflare.com"]',
      '.g-recaptcha',
      '.h-captcha',
      '#cf-challenge-running',
      '#challenge-stage',
    ];

    for (const sel of activeCaptchaSelectors) {
      const el = await page.$(sel);
      if (el && (await el.isVisible().catch(() => false))) {
        return true;
      }
    }

    const title = await page.title().catch(() => '');
    if (title.toLowerCase().includes('just a moment') || title.toLowerCase().includes('attention required')) {
      return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Attempt to click a "Continue" / "Next" button (but never "Submit").
 */
async function clickContinueIfPresent(page) {
  const CONTINUE_PATTERNS = ['continue', 'next', 'next step', 'proceed'];

  const buttons = await page.$$('button, input[type="submit"], input[type="button"]');
  for (const btn of buttons) {
    let text = '';
    try {
      text = await btn.innerText();
    } catch (_) {
      text = (await btn.getAttribute('value')) || '';
    }

    if (!text) continue;
    if (!isSafeToClick(text)) continue;

    const lower = text.toLowerCase().trim();
    if (CONTINUE_PATTERNS.some((p) => lower.includes(p))) {
      await btn.click();
      console.log(`  [FormFiller] Clicked continue button: "${text.trim()}"`);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return true;
    }
  }
  return false;
}

/**
 * Perform real form submission when allowSubmit option is active.
 */
async function clickSubmit(page) {
  const submitSelectors = [
    '#submit_app',
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit Application")',
    'button:has-text("Submit")',
    'input[value*="Submit"]',
  ];

  for (const sel of submitSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn && (await btn.isVisible().catch(() => false))) {
        console.log(`  [FormFiller] Submitting application via selector: "${sel}"`);
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        return true;
      }
    } catch (_) {}
  }
  return false;
}

/**
 * Detect if we've reached the final review/summary screen or ready-to-submit state.
 */
async function isOnReviewPage(page) {
  const content = await page.content().catch(() => '');
  const lower = content.toLowerCase();
  const signals = [
    'review your application',
    'review application',
    'application summary',
    'application review',
    'please review',
    'submit application',
    'submit_app',
  ];
  const hasSignalText = signals.some((s) => lower.includes(s));
  const hasSubmitButton = (await page.$('#submit_app, button[type="submit"], input[type="submit"]')) !== null;

  return hasSignalText || hasSubmitButton;
}

/**
 * Detect if application was successfully submitted (thank you / confirmation page).
 */
async function isSubmittedConfirmationPage(page) {
  const content = await page.content().catch(() => '');
  const lower = content.toLowerCase();
  const confirmationSignals = [
    'thank you for applying',
    'application received',
    'application submitted',
    'thank you for your interest',
    'your application has been submitted',
    'submitted successfully',
  ];
  return confirmationSignals.some((s) => lower.includes(s));
}

module.exports = {
  fillVisibleFields,
  detectCaptcha,
  clickContinueIfPresent,
  clickSubmit,
  isOnReviewPage,
  isSubmittedConfirmationPage,
  isSafeToClick,
};
