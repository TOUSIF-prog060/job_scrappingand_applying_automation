const express = require('express');
const router = express.Router();
const { getCandidate, updateCandidate, uploadResume, resumeUploadMiddleware } = require('../controllers/candidateController');

// GET /api/candidate
router.get('/', getCandidate);

// PUT /api/candidate — update profile fields
router.put('/', updateCandidate);

// POST /api/candidate/resume — multipart/form-data, field name: "resume"
router.post('/resume', resumeUploadMiddleware, uploadResume);

module.exports = router;
