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
 * Known direct Greenhouse field selector mappings.
 */
const DIRECT_MAPPINGS = [
  { selectors: ['#first_name', '#job_application_first_name', 'input[name*="first_name"]', 'input[aria-label*="First Name" i]'], key: 'firstName' },
  { selectors: ['#last_name', '#job_application_last_name', 'input[name*="last_name"]', 'input[aria-label*="Last Name" i]'], key: 'lastName' },
  { selectors: ['#email', '#job_application_email', 'input[name*="email"]', 'input[aria-label*="Email" i]'], key: 'email' },
  { selectors: ['#phone', '#job_application_phone', 'input[name*="phone"]', 'input[type="tel"]', 'input[aria-label*="Phone" i]'], key: 'phone' },
  { selectors: ['#candidate-location', '#location', '#job_application_location', 'input[name*="location"]', 'input[placeholder*="location" i]'], key: 'location' },
  { selectors: ['input[aria-label*="LinkedIn" i]', 'input[id*="linkedin" i]', 'input[name*="linkedin" i]'], key: 'linkedin' },
  { selectors: ['input[aria-label*="GitHub" i]', 'input[id*="github" i]', 'input[name*="github" i]'], key: 'github' },
  { selectors: ['input[aria-label*="Website" i]', 'input[aria-label*="Portfolio" i]', 'input[id*="website" i]', 'input[name*="website" i]'], key: 'website' },
];

/**
 * Known direct Greenhouse EEO & demographic selectors.
 */
const EEO_MAPPINGS = [
  { selectors: ['#gender', 'select[name*="gender"]', 'input[name*="gender"]'], key: 'gender' },
  { selectors: ['#race', '#ethnicity', '#hispanic_ethnicity', 'select[name*="race"]', 'select[name*="ethnicity"]'], key: 'ethnicity' },
  { selectors: ['#veteran_status', 'select[name*="veteran"]', 'input[name*="veteran"]'], key: 'veteranStatus' },
  { selectors: ['#disability_status', 'select[name*="disability"]', 'input[name*="disability"]'], key: 'disabilityStatus' },
  { selectors: ['select[name*="authorized"]', 'select[name*="authorization"]', 'input[name*="authorized"]'], key: 'workAuthorization' },
  { selectors: ['select[name*="sponsorship"]', 'select[name*="visa"]', 'input[name*="sponsorship"]'], key: 'requiresSponsorship' },
];

/**
 * Safely fill an input element with Playwright, handling React/Controlled input events.
 */
async function safelyFillInput(el, value) {
  try {
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.focus().catch(() => {});
    await el.fill(value);
    await el.dispatchEvent('input').catch(() => {});
    await el.dispatchEvent('change').catch(() => {});
    await el.blur().catch(() => {});
    return true;
  } catch (_) {
    try {
      await el.type(value, { delay: 10 });
      return true;
    } catch (_) {
      return false;
    }
  }
}

/**
 * Detect and fill all visible form fields on the current page.
 */
async function fillVisibleFields(page, candidate) {
  const filled = [];
  const skipped = [];

  // 1. Direct Greenhouse Known Input Selectors Fill
  for (const item of DIRECT_MAPPINGS) {
    const value = getCandidateValue(candidate, item.key);
    if (!value) continue;

    for (const sel of item.selectors) {
      try {
        const el = await page.$(sel);
        if (el && (await el.isVisible().catch(() => false))) {
          const current = await el.inputValue().catch(() => '');
          if (!current || current.trim().length === 0) {
            const ok = await safelyFillInput(el, value);
            if (ok) {
              filled.push(item.key);
              break;
            }
          } else {
            filled.push(item.key);
            break;
          }
        }
      } catch (_) {}
    }
  }

  // 2. Direct Greenhouse EEO & Demographic Controls Fill
  for (const item of EEO_MAPPINGS) {
    const value = getCandidateValue(candidate, item.key);
    if (!value) continue;

    for (const sel of item.selectors) {
      try {
        const el = await page.$(sel);
        if (el && (await el.isVisible().catch(() => false))) {
          const tag = await el.evaluate((e) => e.tagName.toLowerCase()).catch(() => '');
          if (tag === 'select') {
            const options = await el.$$eval('option', (opts) =>
              opts.map((o) => ({ value: o.value, text: o.textContent.trim() }))
            );
            const best = options.find(
              (o) =>
                o.text.toLowerCase().includes(value.toLowerCase()) ||
                (o.value && o.value.toLowerCase().includes(value.toLowerCase()))
            );
            if (best) {
              await el.selectOption({ value: best.value });
              filled.push(`EEO: ${item.key}`);
              break;
            }
          } else {
            const ok = await safelyFillInput(el, value);
            if (ok) {
              filled.push(`EEO: ${item.key}`);
              break;
            }
          }
        }
      } catch (_) {}
    }
  }

  // 3. Generic Text / Email / Tel / Search / Number inputs
  const inputs = await page.$$(
    'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])'
  );
  for (const input of inputs) {
    try {
      const isVis = await input.isVisible().catch(() => false);
      if (!isVis) continue;

      const currentValue = await input.inputValue().catch(() => '');
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

      const ok = await safelyFillInput(input, value);
      if (ok) filled.push(label);
    } catch (e) {
      skipped.push(`Input fill error: ${e.message}`);
    }
  }

  // 4. Textareas & Essay Questions
  const textareas = await page.$$('textarea:not([name*="recaptcha"])');
  for (const ta of textareas) {
    try {
      const isVis = await ta.isVisible().catch(() => false);
      if (!isVis) continue;

      const currentValue = await ta.inputValue().catch(() => '');
      if (currentValue && currentValue.trim().length > 0) continue;

      const label = await getLabelForElement(page, ta);
      let value = '';

      if (label) {
        const match = findMatchingKey(label);
        if (match) value = getCandidateValue(candidate, match.key);
      }

      if (!value) {
        value = candidate.coverLetter || candidate.experience || 'N/A';
      }

      const ok = await safelyFillInput(ta, value);
      if (ok) filled.push(label || 'Custom Text Question');
    } catch (e) {
      skipped.push(`Textarea fill error: ${e.message}`);
    }
  }

  // 5. Select Dropdowns
  const selects = await page.$$('select');
  for (const sel of selects) {
    try {
      const isVis = await sel.isVisible().catch(() => false);
      if (!isVis) continue;

      const currentVal = await sel.evaluate((s) => s.value).catch(() => '');
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

  // 6. File inputs — resume & cover letter uploads
  const fileInputs = await page.$$('input[type="file"], #resume, #cover_letter');
  const dataDir = path.resolve(__dirname, '..', 'data');

  for (const fi of fileInputs) {
    try {
      const label = (await getLabelForElement(page, fi)) || '';
      const name = (await fi.getAttribute('name')) || '';
      const id = (await fi.getAttribute('id')) || '';
      const combo = `${label} ${name} ${id}`.toLowerCase();

      let targetFile = null;
      let targetType = 'resume';

      if (combo.includes('cover') || combo.includes('letter')) {
        targetType = 'cover letter';
        const coverFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((f) => f.startsWith('cover_letter.')) : [];
        if (coverFiles.length > 0) {
          targetFile = path.join(dataDir, coverFiles[0]);
        }
      } else {
        const resumeFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((f) => f.startsWith('resume.')) : [];
        if (resumeFiles.length > 0) {
          targetFile = path.join(dataDir, resumeFiles[0]);
        } else if (candidate.resumePath) {
          const fallback = path.resolve(__dirname, '..', candidate.resumePath);
          if (fs.existsSync(fallback)) targetFile = fallback;
        }
      }

      if (targetFile && fs.existsSync(targetFile)) {
        await fi.setInputFiles(targetFile);
        filled.push(`${targetType} file upload (${path.basename(targetFile)})`);
      }
    } catch (e) {
      skipped.push(`file upload error: ${e.message}`);
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

    // Check parent label tag text
    const parentText = await element.evaluate((el) => {
      const parentLabel = el.closest('label');
      return parentLabel ? parentLabel.textContent.trim() : null;
    });
    if (parentText) return parentText;

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
      await page.waitForLoadState('domcontentloaded').catch(() => { });
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
        await page.waitForLoadState('domcontentloaded').catch(() => { });
        return true;
      }
    } catch (_) { }
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

/**
 * Validate that mandatory required fields on the application page are actually populated.
 * Returns { valid: boolean, missingFields: string[] }
 */
async function validateFilledForm(page) {
  const missing = [];
  try {
    // 1. Mandatory core Greenhouse inputs check
    const coreInputs = [
      { sel: '#first_name, #job_application_first_name, input[name*="first_name"]', name: 'First Name' },
      { sel: '#last_name, #job_application_last_name, input[name*="last_name"]', name: 'Last Name' },
      { sel: '#email, #job_application_email, input[name*="email"]', name: 'Email' },
      { sel: '#phone, #job_application_phone, input[name*="phone"]', name: 'Phone' },
    ];

    for (const item of coreInputs) {
      const el = await page.$(item.sel);
      if (el && (await el.isVisible().catch(() => false))) {
        const val = await el.inputValue().catch(() => '');
        if (!val || val.trim().length === 0) {
          missing.push(item.name);
        }
      }
    }

    // 2. HTML5 required elements check
    const requiredEls = await page.$$('input[required], select[required], textarea[required]');
    for (const reqEl of requiredEls) {
      const isVis = await reqEl.isVisible().catch(() => false);
      if (!isVis) continue;

      const tag = await reqEl.evaluate((e) => e.tagName.toLowerCase()).catch(() => '');
      if (tag === 'select') {
        const val = await reqEl.evaluate((s) => s.value).catch(() => '');
        if (!val || val === '' || val === '-1') {
          const label = (await getLabelForElement(page, reqEl)) || 'Required Select';
          if (!missing.includes(label)) missing.push(label);
        }
      } else {
        const val = await reqEl.inputValue().catch(() => '');
        if (!val || val.trim().length === 0) {
          const label = (await getLabelForElement(page, reqEl)) || 'Required Field';
          if (!missing.includes(label)) missing.push(label);
        }
      }
    }
  } catch (e) {
    console.warn(`[FormFiller] Validation error: ${e.message}`);
  }

  return {
    valid: missing.length === 0,
    missingFields: missing,
  };
}

module.exports = {
  fillVisibleFields,
  validateFilledForm,
  detectCaptcha,
  clickContinueIfPresent,
  clickSubmit,
  isOnReviewPage,
  isSubmittedConfirmationPage,
  isSafeToClick,
};
