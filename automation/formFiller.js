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
  { selectors: ['input[aria-label*="Salary" i]', 'input[aria-label*="Compensation" i]', 'input[id*="salary" i]', 'input[name*="salary" i]', 'input[name*="compensation" i]'], key: 'salary' },
  { selectors: ['input[aria-label*="Start Date" i]', 'input[aria-label*="Available" i]', 'input[id*="start_date" i]', 'input[name*="start_date" i]', 'input[name*="availability" i]'], key: 'startDate' },
  { selectors: ['input[aria-label*="How did you hear" i]', 'input[aria-label*="Referral" i]', 'input[id*="referral" i]', 'input[name*="referral" i]', 'input[name*="how_did_you_hear" i]'], key: 'referral' },
  { selectors: ['input[aria-label*="Current Title" i]', 'input[aria-label*="Job Title" i]', 'input[id*="current_title" i]', 'input[name*="current_title" i]', 'input[name*="job_title" i]'], key: 'currentTitle' },
  { selectors: ['input[aria-label*="Education" i]', 'input[aria-label*="Degree" i]', 'input[id*="education" i]', 'input[name*="education" i]', 'input[name*="degree" i]'], key: 'education' },
  { selectors: ['input[aria-label*="Experience" i]', 'input[aria-label*="Years of" i]', 'input[id*="experience" i]', 'input[name*="experience" i]'], key: 'experience' },
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
 * Equivalent phrasings for the same answer, keyed by the lowercased candidate value.
 */
const OPTION_SYNONYMS = {
  male: ['man'],
  female: ['woman'],
  yes: ['true'],
  no: ['false'],
  'i decline to self-identify': ['decline to self identify', 'prefer not to say', "i don't wish to answer", 'do not wish to answer', 'prefer not to disclose'],
  // Forms often reduce the long EEO statements to a plain yes/no
  'i do not have a disability': ['no'],
  'yes, i have a disability': ['yes'],
  'i am not a protected veteran': ['no'],
  'i identify as one or more of the classifications of protected veteran': ['yes'],
};

/**
 * Safely fill an input element with Playwright, handling React/Controlled input events.
 */
async function safelyFillInput(el, value) {
  // Radios/checkboxes are toggled, never typed into — filling one would clobber its value attribute
  const inputType = (await el.getAttribute('type').catch(() => '')) || '';
  if (inputType === 'radio' || inputType === 'checkbox') return false;

  try {
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.focus().catch(() => {});
    await el.fill(value);
    await el.dispatchEvent('input').catch(() => {});
    await el.dispatchEvent('change').catch(() => {});
    await el.evaluate((e) => e.blur()).catch(() => {});
    return true;
  } catch (_) {
    try {
      // Clear first — type() appends, which would corrupt a partially filled field
      await el.evaluate((e) => { e.value = ''; }).catch(() => {});
      await el.type(value, { delay: 10 });
      return true;
    } catch (_) {
      return false;
    }
  }
}

const GENERIC_FIELD_SELECTOR = 'input:not([type="hidden"]), textarea, select';

/**
 * Fields that only appear on an actual job application, used to tell the real form
 * apart from a careers page's search box or newsletter signup.
 */
const APPLICATION_FIELD_SELECTOR = [
  'input[id*="first_name"]',
  'input[name*="first_name"]',
  'input[id*="last_name"]',
  'input[name*="last_name"]',
  'input[aria-label*="First Name" i]',
  'input[aria-label*="Last Name" i]',
  'input[id="email"]',
  'input[id*="job_application"]',
  'input[type="file"]',
].join(', ');

/**
 * Companies commonly embed the Greenhouse form in an iframe on their own careers site,
 * so the main frame holds no fields. Pick whichever frame actually contains the form.
 */
async function resolveFormContext(page) {
  if (typeof page.frames !== 'function') return page; // already a Frame

  const mainFrame = typeof page.mainFrame === 'function' ? page.mainFrame() : page;

  // A frame carrying real application fields always wins over one that merely has
  // inputs — host career pages have their own search and newsletter boxes.
  let bestApplication = null;
  let bestApplicationCount = 0;
  let bestAny = mainFrame;
  let bestAnyCount = await countMatches(mainFrame, GENERIC_FIELD_SELECTOR);

  for (const frame of page.frames()) {
    const appCount = await countMatches(frame, APPLICATION_FIELD_SELECTOR);
    if (appCount > bestApplicationCount) {
      bestApplicationCount = appCount;
      bestApplication = frame;
    }
    if (frame === mainFrame) continue;
    const anyCount = await countMatches(frame, GENERIC_FIELD_SELECTOR);
    if (anyCount > bestAnyCount) {
      bestAnyCount = anyCount;
      bestAny = frame;
    }
  }

  return bestApplication || bestAny;
}

function countMatches(frame, selector) {
  return frame.$$(selector).then((e) => e.length).catch(() => 0);
}

/**
 * Poll until some frame actually exposes form fields. Embedded Greenhouse iframes
 * load well after the host page fires domcontentloaded.
 */
async function waitForFormFields(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ctx = await resolveFormContext(page);
    if ((await countMatches(ctx, APPLICATION_FIELD_SELECTOR)) > 0) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Playwright exposes `keyboard` on Page but not on Frame.
 */
function keyboardOf(ctx) {
  if (ctx.keyboard) return ctx.keyboard;
  if (typeof ctx.page === 'function' && ctx.page()) return ctx.page().keyboard;
  return null;
}

/**
 * Detect and fill all visible form fields on the current page.
 */
async function fillVisibleFields(pageOrFrame, candidate) {
  const page = await resolveFormContext(pageOrFrame);
  const filled = [];
  const skipped = [];

  // 1. Direct Greenhouse Known Input Selectors Fill
  for (const item of DIRECT_MAPPINGS) {
    const value = getCandidateValue(candidate, item.key);
    if (!value) continue;

    let filled_this_item = false;
    for (const sel of item.selectors) {
      if (filled_this_item) break;
      try {
        const el = await page.$(sel);
        if (el && (await el.isVisible().catch(() => false))) {
          const current = await el.inputValue().catch(() => '');
          if (!current || current.trim().length === 0) {
            const ok = await safelyFillInput(el, value);
            if (ok) {
              filled.push(item.key);
              filled_this_item = true;
            }
          } else {
            filled.push(item.key);
            filled_this_item = true;
          }
        }
      } catch (_) {}
    }
  }

  // 2. Direct Greenhouse EEO & Demographic Controls Fill
  for (const item of EEO_MAPPINGS) {
    const value = getCandidateValue(candidate, item.key);
    if (!value) continue;

    let filled_this_item = false;
    for (const sel of item.selectors) {
      if (filled_this_item) break;
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
              filled_this_item = true;
            }
          } else {
            const ok = await safelyFillInput(el, value);
            if (ok) {
              filled.push(`EEO: ${item.key}`);
              filled_this_item = true;
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
      if (!label) {
        const name = await input.getAttribute('name').catch(() => '');
        const id = await input.getAttribute('id').catch(() => '');
        if (!name && !id) continue;
      }

      const effectiveLabel = label || (await input.getAttribute('name').catch(() => '')) || (await input.getAttribute('id').catch(() => '')) || 'Unknown Field';
      const match = findMatchingKey(effectiveLabel);
      if (!match) {
        if (label) skipped.push(effectiveLabel);
        continue;
      }

      const value = getCandidateValue(candidate, match.key);
      if (!value) continue;

      const ok = await safelyFillInput(input, value);
      if (ok) filled.push(effectiveLabel);
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
      const effectiveLabel = label || (await ta.getAttribute('name').catch(() => '')) || (await ta.getAttribute('id').catch(() => '')) || 'Custom Text Question';
      let value = '';

      if (label) {
        const match = findMatchingKey(label);
        if (match) value = getCandidateValue(candidate, match.key);
      }

      if (!value && effectiveLabel !== 'Custom Text Question') {
        const match = findMatchingKey(effectiveLabel);
        if (match) value = getCandidateValue(candidate, match.key);
      }

      if (!value) {
        value = candidate.coverLetter || candidate.experience || 'N/A';
      }

      const ok = await safelyFillInput(ta, value);
      if (ok) filled.push(effectiveLabel);
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
      const effectiveLabel = label || (await sel.getAttribute('name').catch(() => '')) || (await sel.getAttribute('id').catch(() => '')) || 'Unknown Select';

      const match = findMatchingKey(effectiveLabel);
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
          filled.push(effectiveLabel);
          continue;
        }
      }

      if (!currentVal || currentVal === '' || currentVal === '-1') {
        const validOpt = options.find((o) => o.value !== '' && o.value !== '-1' && !o.text.toLowerCase().includes('select'));
        if (validOpt) {
          await sel.selectOption({ value: validOpt.value });
          filled.push(`${effectiveLabel} (auto-selected option)`);
        }
      }
    } catch (e) {
      skipped.push(`Select error: ${e.message}`);
    }
  }

  // 5b. Custom React comboboxes — Greenhouse renders its dropdowns as react-select,
  //     which ignores fill() and must be opened and clicked like a real user.
  const comboboxes = await page.$$('input[role="combobox"]');
  for (const cb of comboboxes) {
    try {
      if (!(await cb.isVisible().catch(() => false))) continue;

      const label = await getLabelForElement(page, cb);
      if (!label) continue;

      const match = findMatchingKey(label);
      if (!match) {
        skipped.push(`Dropdown: ${label}`);
        continue;
      }

      const value = getCandidateValue(candidate, match.key);
      if (!value) continue;

      const picked = await selectComboboxOption(page, cb, value);
      if (picked) filled.push(`${label} = ${picked}`);
      else skipped.push(`Dropdown (no matching option): ${label}`);
    } catch (e) {
      skipped.push(`Combobox error: ${e.message}`);
    }
  }

  // 6. Radio button groups (EEO / yes-no questions rendered as radios)
  const radios = await page.$$('input[type="radio"]');
  const radioGroups = new Map();
  for (const radio of radios) {
    const name = (await radio.getAttribute('name').catch(() => '')) || '';
    if (!name) continue;
    if (!radioGroups.has(name)) radioGroups.set(name, []);
    radioGroups.get(name).push(radio);
  }

  for (const [groupName, groupRadios] of radioGroups) {
    try {
      let alreadyChecked = false;
      for (const r of groupRadios) {
        if (await r.isChecked().catch(() => false)) { alreadyChecked = true; break; }
      }
      if (alreadyChecked) continue;

      const questionText = await getRadioGroupQuestion(page, groupRadios[0], groupName);
      const match = findMatchingKey(questionText);
      if (!match) {
        skipped.push(`Radio group: ${questionText}`);
        continue;
      }

      const value = getCandidateValue(candidate, match.key);
      if (!value) continue;

      for (const r of groupRadios) {
        const optionLabel = await getRadioOptionLabel(page, r);
        if (!optionLabel) continue;
        if (optionLabel.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(optionLabel.toLowerCase())) {
          await r.scrollIntoViewIfNeeded().catch(() => {});
          await r.check().catch(async () => { await r.click().catch(() => {}); });
          filled.push(`${questionText} = ${optionLabel}`);
          break;
        }
      }
    } catch (e) {
      skipped.push(`Radio group error: ${e.message}`);
    }
  }

  // 7. File inputs — resume & cover letter uploads
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

    const ariaLabelledBy = await element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const ids = ariaLabelledBy.split(' ');
      for (const labelId of ids) {
        const labelEl = await page.$(`#${labelId}`);
        if (labelEl) {
          const text = await labelEl.innerText();
          if (text && text.trim()) return text.trim();
        }
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
 * Escape an id for use in a CSS selector (ids here contain digits and dashes).
 */
function CSS_escape(id) {
  return id.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

async function pressEscape(ctx) {
  const kb = keyboardOf(ctx);
  if (kb) await kb.press('Escape').catch(() => {});
}

/**
 * Collect the option elements belonging to one open combobox.
 * Never queries options globally — unrelated always-mounted menus (such as the phone
 * widget's country list) would otherwise be treated as this field's choices.
 */
async function findOptionsForCombobox(ctx, combobox) {
  const listboxId = await combobox.getAttribute('aria-controls').catch(() => null);
  if (listboxId) {
    const scoped = await ctx.$$(`#${CSS_escape(listboxId)} [role="option"]`).catch(() => []);
    if (scoped.length) return scoped;
  }

  // Some react-select builds omit aria-controls; the menu still renders inside a
  // shared ancestor with the input, so walk up to the nearest one that holds options.
  const handle = await combobox
    .evaluateHandle((el) => {
      let node = el;
      for (let i = 0; i < 6 && node.parentElement; i++) {
        node = node.parentElement;
        if (node.querySelector('[role="option"]')) return node;
      }
      return null;
    })
    .catch(() => null);

  const container = handle && handle.asElement();
  if (!container) return [];
  return await container.$$('[role="option"]').catch(() => []);
}

/**
 * Open a react-select style combobox and click the option best matching `value`.
 * Returns the chosen option text, or null if nothing matched.
 */
async function selectComboboxOption(page, combobox, value) {
  await combobox.scrollIntoViewIfNeeded().catch(() => {});
  await combobox.click().catch(() => {});
  await page.waitForTimeout(350);

  const options = await findOptionsForCombobox(page, combobox);
  if (options.length === 0) {
    await pressEscape(page);
    return null;
  }

  const target = value.toLowerCase().trim();
  const entries = [];
  for (const opt of options) {
    const text = ((await opt.innerText().catch(() => '')) || '').trim();
    if (text) entries.push({ opt, text, lower: text.toLowerCase() });
  }

  // Exact first, then option-contains-value, then value-contains-option (long options only,
  // so a short option like "No" can't hijack "I do not have a disability")
  let chosen =
    entries.find((e) => e.lower === target) ||
    entries.find((e) => e.lower.includes(target)) ||
    entries.find((e) => e.text.length >= 4 && target.includes(e.lower));

  // Forms word the same answer differently ("Male" vs "Man") — try known equivalents
  if (!chosen) {
    for (const alt of OPTION_SYNONYMS[target] || []) {
      chosen = entries.find((e) => e.lower === alt) || entries.find((e) => e.lower.includes(alt));
      if (chosen) break;
    }
  }

  if (!chosen) {
    await pressEscape(page);
    return null;
  }

  await chosen.opt.click().catch(() => {});
  await page.waitForTimeout(250);
  return chosen.text;
}

/**
 * Resolve a single radio option's visible choice text.
 * Deliberately ignores the `name` attribute — it is shared by the whole group
 * and would match every option identically.
 */
async function getRadioOptionLabel(page, radio) {
  try {
    const ariaLabel = await radio.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const id = await radio.getAttribute('id');
    if (id) {
      const labelEl = await page.$(`label[for="${id}"]`);
      if (labelEl) {
        const text = await labelEl.innerText();
        if (text && text.trim()) return text.trim();
      }
    }

    const parentText = await radio.evaluate((el) => {
      const parentLabel = el.closest('label');
      return parentLabel ? parentLabel.textContent.trim() : null;
    });
    if (parentText) return parentText;

    const value = await radio.getAttribute('value');
    if (value && value.trim()) return value.trim();

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Find the question text a radio group belongs to (legend / group aria-label / name attribute).
 */
async function getRadioGroupQuestion(page, radio, groupName) {
  try {
    const fromDom = await radio.evaluate((el) => {
      const fieldset = el.closest('fieldset');
      const legend = fieldset ? fieldset.querySelector('legend') : null;
      if (legend && legend.textContent.trim()) return legend.textContent.trim();

      const group = el.closest('[role="radiogroup"], [role="group"]');
      if (group) {
        const aria = group.getAttribute('aria-label');
        if (aria && aria.trim()) return aria.trim();
      }
      return null;
    });
    if (fromDom) return fromDom;
  } catch (_) {}
  return groupName;
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
 * Click an "Apply" entry button on a job landing page that has no form yet.
 * Callers must only invoke this when nothing has been filled — on a completed
 * form an "Apply" button can be the submit control.
 */
async function clickApplyEntryIfPresent(pageOrFrame) {
  const page = await resolveFormContext(pageOrFrame);
  if ((await countMatches(page, APPLICATION_FIELD_SELECTOR)) > 0) return false;

  const APPLY_PATTERNS = ['apply now', 'apply for this job', 'apply to this job', 'apply'];
  const candidates = await page.$$('a, button');

  for (const el of candidates) {
    let text = '';
    try {
      text = (await el.innerText()) || '';
    } catch (_) {
      continue;
    }
    const lower = text.toLowerCase().trim();
    if (!lower || lower.length > 30) continue;
    if (!isSafeToClick(lower)) continue;
    if (!APPLY_PATTERNS.some((p) => lower === p || lower.startsWith(p))) continue;
    if (!(await el.isVisible().catch(() => false))) continue;

    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click().catch(() => {});
    console.log(`  [FormFiller] Clicked apply entry button: "${text.trim()}"`);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return true;
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
async function isOnReviewPage(pageOrFrame) {
  const page = await resolveFormContext(pageOrFrame);
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
async function validateFilledForm(pageOrFrame) {
  const page = await resolveFormContext(pageOrFrame);
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

      // Greenhouse pairs each combobox with an aria-hidden proxy input carrying `required`.
      // It is never user-fillable, so validating it would always report a phantom failure.
      const isProxy = await reqEl.evaluate(
        (e) => e.getAttribute('aria-hidden') === 'true' || e.getAttribute('tabindex') === '-1'
      ).catch(() => false);
      if (isProxy) continue;

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
  resolveFormContext,
  waitForFormFields,
  validateFilledForm,
  detectCaptcha,
  clickContinueIfPresent,
  clickApplyEntryIfPresent,
  clickSubmit,
  isOnReviewPage,
  isSubmittedConfirmationPage,
  isSafeToClick,
};
