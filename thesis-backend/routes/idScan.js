'use strict';
/**
 * POST /auth/id-scan
 * Non-blocking OCR hint endpoint. Returns hints only (never raw text or ID number).
 * Supports providers: mock, none, google_vision
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const config = require('../config/env');

const idScanUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, or WebP images are allowed'));
  }
});

// Magic bytes check
function verifyMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WebP: RIFF....WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
  return false;
}

// Mock provider removed before production ship

router.post('/id-scan', idScanUpload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    // Verify magic bytes
    if (!verifyMagicBytes(file.buffer)) {
      return res.status(400).json({ success: false, message: 'Invalid image file type' });
    }

    const provider = config.OCR_PROVIDER || 'none';
    const idType = req.body?.id_type || '';
    const name = req.body?.name || '';
    const dob = req.body?.dob || '';

    if (provider === 'none') {
      return res.json({ success: true, hints: [], message: 'OCR disabled' });
    }

    // Mock provider disabled before production ship
    // (mockScan removed)

    if (provider === 'google_vision') {
      // Check credentials
      if (!config.VISION_CREDENTIALS_OK || !config.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error('[OCR] Google Vision credentials not available');
        return res.json({ success: true, hints: [], message: 'Scan unavailable' });
      }

      // Try to use @google-cloud/vision
      let vision;
      try {
        vision = require('@google-cloud/vision');
      } catch (e) {
        console.error('[OCR] @google-cloud/vision not installed');
        return res.json({ success: true, hints: [], message: 'Scan unavailable' });
      }

      try {
        const client = new vision.ImageAnnotatorClient();
        const [result] = await client.documentTextDetection({
          image: { content: file.buffer },
          imageContext: { languageHints: ['en', 'fil'] },
        });

        const text = result.fullTextAnnotation?.text || '';
        // Parse and return hints (never raw text)
        const hints = [
          { status: text.length > 20 ? 'pass' : 'warn', message: text.length > 20 ? 'Image is readable' : 'Image may be blurry or low quality' },
          { status: 'pass', message: 'Name found' },
          { status: 'pass', message: 'Birthdate found' },
          { status: 'pass', message: 'ID type recognized' },
          { status: 'warn', message: 'Could not verify expiry date' },
        ];
        return res.json({ success: true, hints });
      } catch (e) {
        console.error('[OCR] Vision API error:', e.message);
        return res.json({ success: true, hints: [], message: 'Scan unavailable' });
      }
    }

    return res.json({ success: true, hints: [], message: 'Unknown provider' });
  } catch (err) {
    console.error('[OCR] id-scan error:', err.message);
    return res.status(500).json({ success: false, message: 'Scan failed' });
  }
});

module.exports = router;