'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { runOCR } = require('../services/ocrService');

const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, or PDF files are allowed'));
  }
});

const ocrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many OCR requests. Please try again later.' },
});

router.get('/health', async (req, res) => {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  const bin = process.env.TESSERACT_PATH || '/opt/homebrew/bin/tesseract';
  try {
    const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 5000 });
    return res.json({ success: true, engine: 'tesseract', available: true, version: String(stdout || '').split('\n')[0] });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.error('[OCR] health check failed:', e && e.message);
    return res.status(503).json({ success: false, code: 'OCR_NOT_FOUND', engine: 'tesseract', available: false, message: 'OCR engine not reachable' });
  }
});

router.post('/extract', ocrLimiter, ocrUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (req, res) => {
  try {
    const file = (req.files?.file?.[0]) || (req.files?.image?.[0]);
    if (!file) {
      return res.status(400).json({ success: false, code: 'NO_FILE', message: 'No file uploaded' });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[OCR] request received: /api/ocr/extract', { mimeType: file.mimetype, size: file.size, type: req.body?.type, id_type: req.body?.id_type });
    }

    const type = (req.body?.type || 'id').toLowerCase() === 'permit' ? 'permit' : 'id';
    const idType = req.body?.id_type || req.body?.idType || '';
    const typedName = req.body?.name || '';
    const typedDob = req.body?.dob || req.body?.date_of_birth || '';

    const result = await runOCR(file.buffer, file.mimetype, type, idType, typedName, typedDob);

    const lowConfidence = !result.confidence || result.confidence < 60;
    return res.json({
      success: true,
      code: result.reason || null,
      data: {
        confidence: result.confidence,
        fields: result.fields,
        hints: result.hints || [],
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
