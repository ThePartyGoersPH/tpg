use strict';
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
function resolveTesseractBin() {
  const candidates = [];
  if (process.env.TESSERACT_PATH) candidates.push(process.env.TESSERACT_PATH);
  candidates.push('/opt/homebrew/bin/tesseract', '/usr/local/bin/tesseract', '/usr/bin/tesseract', 'tesseract');
  for (const c of candidates) {
    try {
      const { execFileSync } = require('child_process');
      execFileSync(c, ['--version'], { stdio: 'pipe', timeout: 5000 });
      return c;
    } catch (e) {}
  }
  return process.env.TESSERACT_PATH || 'tesseract';
}
const TESSERACT_BIN = resolveTesseractBin();
const OCR_TIMEOUT_MS = 20000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
let tesseractAvailable = false;
try {
  const { execFileSync } = require('child_process');
  execFileSync(TESSERACT_BIN, ['--version'], { stdio: 'pipe', timeout: 5000 });
  tesseractAvailable = true;
} catch (e) { console.warn('[OCR] WARNING: tesseract not found on PATH.'); }
let availableLangs = ['eng'];
try {
  const { execFileSync } = require('child_process');
  const out = execFileSync(TESSERACT_BIN, ['--list-langs'], { stdio: 'pipe', timeout: 5000 }).toString();
  if (out.includes('fil')) availableLangs.push('fil');
  if (out.includes('osd')) availableLangs.push('osd');
} catch (e) {}
const LANGS = availableLangs.includes('fil') ? 'eng+fil' : 'eng';
async function preprocessImage(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    try {
      const img = sharp(buffer, { density: 200, page: 0 });
      const png = await img.png();
      return preprocessImage(png, 'image/png');
    } catch (e) { throw new Error('PDF rendering unavailable'); }
  }
  let img = sharp(buffer);
  const meta = await img.metadata();
  img = img.rotate();
  const minLongSide = 2000;
  if (meta.width && meta.height) {
    const longSide = Math.max(meta.width, meta.height);
    if (longSide < minLongSide) {
      const scale = minLongSide / longSide;
      img = img.resize(Math.round(meta.width * scale), Math.round(meta.height * scale), { fit: 'inside' });
    } else if (longSide > 3000) {
      const scale = 3000 / longSide;
      img = img.resize(Math.round(meta.width * scale), Math.round(meta.height * scale), { fit: 'inside' });
    }
  }
  img = img.grayscale().normalize().sharpen();
  return img.png().toBuffer();
}
async function runTesseract(buffer, psm = 6) {
  if (!tesseractAvailable) {
    return { text: '', confidence: 0, error: 'OCR unavailable: tesseract not installed', fields: {} };
  }
  const tmpDir = path.join(process.cwd(), 'private-uploads', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  const tmpFile = path.join(tmpDir, 'ocr_' + crypto.randomUUID() + '.png');
  const tmpOut = path.join(tmpDir, 'ocr_' + crypto.randomUUID());
  try {
    fs.writeFileSync(tmpFile, buffer);
    const args = [tmpFile, tmpOut, '-l', LANGS, '--oem', '1', '--psm', String(psm), 'tsv'];
    const { stdout, stderr } = await execFileAsync(TESSERACT_BIN, args, { timeout: OCR_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 });
    let text = '';
    let confidence = 0;
    const fields = {};
    const tsvPath = tmpOut + '.tsv';
    if (fs.existsSync(tsvPath)) {
      const tsv = fs.readFileSync(tsvPath, 'utf8');
      const lines = tsv.split('
').slice(1);
      let totalConf = 0, count = 0;
      for (const line of lines) {
        const cols = line.split('	');
        if (cols.length >= 12) {
          const conf = parseFloat(cols[10]);
          const word = cols[11]?.trim();
          if (!isNaN(conf) && conf >= 0 && word) {
            text += word + ' ';
            confidence = Math.max(confidence, conf);
            count++;
            if (word) { fields[word.toLowerCase()] = word; }
          }
        }
      }
      if (count > 0) { confidence = Math.min(confidence, 100); }
    }
    text = text.trim().replace(/\s+/g, ' ');
    return { text, confidence, fields, error: null };
  } catch (err) { console.error('[OCR] Tesseract error:', err && err.message); return { text: '', confidence: 0, error: 'OCR failed', fields: {} }; } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    try { fs.unlinkSync(tmpOut + '.tsv'); } catch (e) {}
  }
}
function extractNameAndDob(text) {
  if (!text) return { name: null, dob: null };
  const normalized = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nameMatch = normalized.match(/[a-zà-ü'-]+ [a-zà-ü'-]+/);
  const name = nameMatch ? nameMatch[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null;
  const dob = extractBirthdate(normalized);
  return { name, dob };
}
function extractBirthdate(text) {
  if (!text) return null;
  const patterns = [/(\d{4})[\/-](\d{2})[\/-](\d{2})/, /(\d{2})[\/-](\d{2})[\/-](\d{4})/, /(\d{1,2})\s(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]?\s(\d{4})/i, /([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = new Date(match[0]);
      if (!isNaN(parsed)) {
        return { date: parsed.toISOString().split('T')[0], expired: false };
      }
    }
  }
  return null;
}
module.exports = { preprocessImage, runTesseract, extractNameAndDob, tesseractAvailable, LANGS, TESSERACT_BIN };
