
'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { runOCR, tesseractAvailable, LANGS } = require('../services/ocrService');

const uploadLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many OCR requests. Please try again later.' },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG, PNG, WebP, or PDF files are allowed'));
};

const ocrUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

router.get('/health', async (req, res) => {
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const bin = process.env.TESSERACT_PATH || '/opt/homebrew/bin/tesseract';
    try {
      const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 5000 });
      return res.json({ success: true, engine: 'tesseract', available: true, version: String(stdout || '').split('
')[0] });
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.error('[OCR] health check failed:', e && e.message);
      return res.status(503).json({ success: false, code: 'OCR_NOT_FOUND', engine: 'tesseract', available: false, message: 'OCR engine not reachable' });
    }
  } catch (e) {
    return res.status(503).json({ success: false, code: 'OCR_NOT_FOUND', engine: 'tesseract', available: false, message: 'OCR engine not reachable' });
  }
});

router.post('/extract', uploadLimiter, ocrUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, code: 'NO_FILE', message: 'No file uploaded' });
    }

    const type = (req.body.type || 'id').toLowerCase() === 'permit' ? 'permit' : 'id';
    const idType = req.body.idType || req.body.id_type || '';
    const typedName = req.body.name || '';
    const typedDob = req.body.dob || req.body.date_of_birth || '';

    const preprocessed = await runOCR(req.file.buffer, req.file.mimetype, type, idType, typedName, typedDob);

    const lowConfidence = !preprocessed.confidence || preprocessed.confidence < 60;
    return res.json({
      success: true,
      code: preprocessed.error || null,
      data: {
        confidence: preprocessed.confidence,
        fields: preprocessed.fields || {},
        hints: [],
        lowConfidence,
        message: lowConfidence ? 'Please check these details' : null,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[OCR] extract error:', err && err.message);
    return res.status(500).json({ success: false, code: 'OCR_FAILED', message: 'OCR processing failed' });
  }
});

module.exports = router;
