const fs = require('fs');

/**
 * Common technical skills dictionary for auto-tagging.
 */
const SKILL_KEYWORDS = [
  'JavaScript', 'TypeScript', 'React', 'React.js', 'Node.js', 'Node', 'Python',
  'Java', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  'HTML', 'CSS', 'Tailwind', 'Sass', 'Bootstrap',
  'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite',
  'Express', 'Next.js', 'Vite', 'Django', 'Flask', 'Spring',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
  'Git', 'GitHub', 'CI/CD', 'Linux', 'REST', 'RESTful', 'GraphQL',
  'Playwright', 'Puppeteer', 'Selenium', 'Jest', 'Cypress',
  'LLM', 'AI', 'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow'
];

/**
 * Parse text content from a PDF file and extract structured candidate fields.
 *
 * @param {string} filePath - Path to the PDF resume
 * @param {Object} currentCandidate - Existing candidate profile to overlay on
 * @returns {Promise<Object>} Updated candidate profile object
 */
async function parseAndExtractResume(filePath, currentCandidate = {}) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);

    let text = '';
    try {
      const pdfModule = require('pdf-parse');
      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse(uint8Array);
        const data = await parser.getText();
        if (typeof data === 'string') text = data;
        else if (data && data.text) text = data.text;
        else if (data && Array.isArray(data.pages)) {
          text = data.pages.map((p) => (p.text ? p.text : JSON.stringify(p))).join('\n');
        }
      } else if (typeof pdfModule === 'function') {
        const data = await pdfModule(dataBuffer);
        text = data.text || '';
      }
    } catch (e) {
      console.warn('[ResumeParser] Primary PDFParse attempt failed, trying raw text scan:', e.message);
      text = dataBuffer.toString('utf8');
    }

    if (!text.trim()) {
      return currentCandidate;
    }

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const extracted = { ...currentCandidate };

    // 1. Extract Email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
    if (emailMatch) {
      extracted.email = emailMatch[0];
    }

    // 2. Extract Phone Number
    const phoneMatch = text.match(/(?:\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}|\+?\d{10,13}/);
    if (phoneMatch) {
      extracted.phone = phoneMatch[0];
    }

    // 3. Extract LinkedIn URL
    const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i);
    if (linkedinMatch) {
      extracted.linkedin = linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`;
    }

    // 4. Extract GitHub URL
    const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/?/i);
    if (githubMatch) {
      extracted.github = githubMatch[0].startsWith('http') ? githubMatch[0] : `https://${githubMatch[0]}`;
    }

    // 5. Extract Candidate Name (First non-empty line usually states candidate name)
    const possibleNameLine = lines.find(
      (l) =>
        l.length < 50 &&
        !l.includes('@') &&
        !l.includes('http') &&
        !/\d{5,}/.test(l) &&
        !l.toLowerCase().includes('resume') &&
        !l.toLowerCase().includes('curriculum')
    );

    if (possibleNameLine) {
      // Split header line (e.g. "TOUSIF RAZA | Bengaluru" or "TOUSIF RAZA")
      const cleanLine = possibleNameLine.split('|')[0].trim();
      const parts = cleanLine.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
      if (parts.length >= 2) {
        extracted.firstName = capitalize(parts[0]);
        extracted.lastName = parts.slice(1).map(capitalize).join(' ');
      } else if (parts.length === 1 && parts[0].length > 1) {
        extracted.firstName = capitalize(parts[0]);
      }
    }

    // 6. Extract Location (City/Country pattern or lines with city names)
    const locationMatch = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z][a-z]+|[A-Z]{2})/);
    if (locationMatch) {
      extracted.location = locationMatch[0];
    } else {
      const cityMatch = lines.find((l) => /bengaluru|bangalore|mumbai|delhi|pune|hyderabad|chennai|san francisco|new york|london|paris|remote/i.test(l));
      if (cityMatch) {
        extracted.location = cityMatch.split('|')[0].trim();
      }
    }

    // 7. Extract Skills matching dictionary
    const foundSkills = new Set(extracted.skills || []);
    for (const skill of SKILL_KEYWORDS) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(text)) {
        foundSkills.add(skill);
      }
    }
    if (foundSkills.size > 0) {
      extracted.skills = Array.from(foundSkills);
    }

    // 8. Extract Education snippet if present
    const eduLine = lines.find((l) =>
      /b\.e\.|b\.tech|b\.s\.|m\.s\.|master|bachelor|degree|university|college/i.test(l)
    );
    if (eduLine) {
      extracted.education = eduLine.slice(0, 100);
    }

    // 9. Extract Current Title / Role
    const titleLine = lines.find((l) =>
      /engineer|developer|intern|manager|analyst|consultant|architect|specialist/i.test(l)
    );
    if (titleLine) {
      extracted.currentTitle = titleLine.split('|')[0].trim().slice(0, 60);
    }

    console.log(`[ResumeParser] Parsed profile for: ${extracted.firstName} ${extracted.lastName}`);
    return extracted;
  } catch (err) {
    console.error('[ResumeParser] PDF parsing warning:', err.message);
    return currentCandidate;
  }
}

function capitalize(str = '') {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

module.exports = { parseAndExtractResume };
