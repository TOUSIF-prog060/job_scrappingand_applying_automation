const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parseAndExtractResume } = require('../services/resumeParser');
const { recalculateAllMatchScores } = require('../services/jobService');

const CANDIDATE_PATH = path.join(__dirname, '..', '..', 'data', 'candidate.json');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// ── Multer — multi-format resume and cover letter upload ──────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    cb(null, DATA_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    if (file.fieldname === 'coverLetter') {
      cb(null, `cover_letter${ext}`);
    } else {
      cb(null, `resume${ext}`);
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.docx', '.doc', '.txt'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Allowed file types: ${allowed.join(', ')}`));
    }
  },
});

// ── Controllers ───────────────────────────────────────────────────────────────

async function getCandidate(req, res) {
  try {
    const candidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
    const resumeFiles = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('resume.'));
    const coverFiles = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('cover_letter.'));

    const hasResume = resumeFiles.length > 0;
    const hasCoverLetter = coverFiles.length > 0;
    const resumeFileName = candidate.resumeFileName || (hasResume ? resumeFiles[0] : null);
    const coverLetterFileName = candidate.coverLetterFileName || (hasCoverLetter ? coverFiles[0] : null);

    res.json({
      ...candidate,
      hasResume,
      hasCoverLetter,
      resumeFileName,
      coverLetterFileName,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load candidate profile: ' + err.message });
  }
}

async function updateCandidate(req, res) {
  try {
    let currentCandidate = {};
    if (fs.existsSync(CANDIDATE_PATH)) {
      try {
        currentCandidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
      } catch (_) {}
    }

    const updated = {
      ...currentCandidate,
      ...req.body,
    };

    fs.writeFileSync(CANDIDATE_PATH, JSON.stringify(updated, null, 2), 'utf8');

    // Recalculate match scores across all jobs
    try { recalculateAllMatchScores(updated); } catch (e) { console.error(e); }

    const resumeFiles = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('resume.'));
    const coverFiles = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('cover_letter.'));

    res.json({
      message: 'Candidate profile updated successfully.',
      candidate: {
        ...updated,
        hasResume: resumeFiles.length > 0,
        hasCoverLetter: coverFiles.length > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update candidate profile: ' + err.message });
  }
}

async function uploadResume(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded.' });
    }

    let currentCandidate = {};
    if (fs.existsSync(CANDIDATE_PATH)) {
      try {
        currentCandidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
      } catch (_) {}
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.pdf';
    const resumePath = path.join(DATA_DIR, `resume${ext}`);

    const updatedCandidate = await parseAndExtractResume(resumePath, currentCandidate);
    updatedCandidate.resumePath = `./data/resume${ext}`;
    updatedCandidate.resumeFileName = req.file.originalname;

    fs.writeFileSync(CANDIDATE_PATH, JSON.stringify(updatedCandidate, null, 2), 'utf8');

    try { recalculateAllMatchScores(updatedCandidate); } catch (e) { console.error(e); }

    res.json({
      message: `Resume file "${req.file.originalname}" uploaded and parsed successfully!`,
      filename: req.file.originalname,
      candidate: { ...updatedCandidate, hasResume: true },
    });
  } catch (err) {
    console.error('[UploadResume Error]', err);
    res.status(500).json({ error: err.message });
  }
}

async function uploadCoverLetter(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No cover letter file uploaded.' });
    }

    let currentCandidate = {};
    if (fs.existsSync(CANDIDATE_PATH)) {
      try {
        currentCandidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
      } catch (_) {}
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.pdf';
    const coverPath = path.join(DATA_DIR, `cover_letter${ext}`);

    // If it's a txt or docx file, also read text to update coverLetter field
    if (ext === '.txt') {
      const text = fs.readFileSync(coverPath, 'utf8');
      if (text.trim()) currentCandidate.coverLetter = text.trim();
    }

    currentCandidate.coverLetterPath = `./data/cover_letter${ext}`;
    currentCandidate.coverLetterFileName = req.file.originalname;

    fs.writeFileSync(CANDIDATE_PATH, JSON.stringify(currentCandidate, null, 2), 'utf8');

    res.json({
      message: `Cover Letter file "${req.file.originalname}" uploaded successfully!`,
      filename: req.file.originalname,
      candidate: { ...currentCandidate, hasCoverLetter: true },
    });
  } catch (err) {
    console.error('[UploadCoverLetter Error]', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getCandidate,
  updateCandidate,
  uploadResume,
  uploadCoverLetter,
  documentUploadMiddleware: upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 },
  ]),
  resumeUploadMiddleware: upload.single('resume'),
  coverLetterUploadMiddleware: upload.single('coverLetter'),
};
