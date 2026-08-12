const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parseAndExtractResume } = require('../services/resumeParser');

const CANDIDATE_PATH = path.join(__dirname, '..', '..', 'data', 'candidate.json');
const RESUME_PATH = path.join(__dirname, '..', '..', 'data', 'resume.pdf');

// ── Multer — save uploaded file directly to data/resume.pdf ──────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'resume.pdf'); // always overwrite
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted.'));
    }
  },
});

// ── Controllers ───────────────────────────────────────────────────────────────

async function getCandidate(req, res) {
  try {
    const candidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
    const hasResume = fs.existsSync(RESUME_PATH);
    const { resumePath, ...safe } = candidate;
    res.json({ ...safe, hasResume });
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
      resumePath: currentCandidate.resumePath || './data/resume.pdf',
    };

    fs.writeFileSync(CANDIDATE_PATH, JSON.stringify(updated, null, 2), 'utf8');

    const hasResume = fs.existsSync(RESUME_PATH);
    const { resumePath, ...safe } = updated;

    res.json({
      message: 'Candidate profile updated successfully.',
      candidate: { ...safe, hasResume },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update candidate profile: ' + err.message });
  }
}

async function uploadResume(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    let currentCandidate = {};
    if (fs.existsSync(CANDIDATE_PATH)) {
      try {
        currentCandidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
      } catch (_) {}
    }

    const updatedCandidate = await parseAndExtractResume(RESUME_PATH, currentCandidate);
    fs.writeFileSync(CANDIDATE_PATH, JSON.stringify(updatedCandidate, null, 2), 'utf8');

    const { resumePath, ...safe } = updatedCandidate;

    res.json({
      message: 'Resume uploaded and parsed successfully!',
      filename: req.file.originalname,
      candidate: { ...safe, hasResume: true },
    });
  } catch (err) {
    console.error('[UploadResume Error]', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getCandidate,
  updateCandidate,
  uploadResume,
  resumeUploadMiddleware: upload.single('resume'),
};
