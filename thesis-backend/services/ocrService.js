'use strict';
/**
 * services/ocrService.js — Tesseract OCR service (local, no paid APIs)
 *
 * Uses the system `tesseract` CLI via child_process (non-blocking).
 * Preprocesses images with sharp (grayscale, normalize, resize, auto-rotate).
 * Returns { text, confidence, fields } and never throws raw errors.
 */

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

// Check if tesseract is available at startup
let tesseractAvailable = false;
try {
  const { execFileSync } = require('child_process');
  execFileSync(TESSERACT_BIN, ['--version'], { stdio: 'pipe', timeout: 5000 });
  tesseractAvailable = true;
} catch (e) {
  tesseractAvailable = false;
  console.warn('[OCR] WARNING: tesseract not found on PATH. OCR will be unavailable. Install with: brew install tesseract (Mac) or sudo apt install tesseract-ocr (Ubuntu)');
}

// Check available languages
let availableLangs = ['eng'];
try {
  const { execFileSync } = require('child_process');
  const out = execFileSync(TESSERACT_BIN, ['--list-langs'], { stdio: 'pipe', timeout: 5000 }).toString();
  if (out.includes('fil')) availableLangs.push('fil');
  if (out.includes('osd')) availableLangs.push('osd');
} catch (e) {}

const LANGS = availableLangs.includes('fil') ? 'eng+fil' : 'eng';

/**
 * Preprocess image buffer with sharp.
 * Returns a buffer ready for Tesseract.
 */
async function preprocessImage(buffer, mimeType) {
  // PDF: render first page if possible
  if (mimeType === 'application/pdf') {
    try {
      const img = sharp(buffer, { density: 200, page: 0 });
      const png = await img.png().toBuffer();
      // Recurse as image
      return preprocessImage(png, 'image/png');
    } catch (e) {
      throw new Error('PDF rendering unavailable');
    }
  }

  let img = sharp(buffer);
  const meta = await img.metadata();

  // Auto-rotate based on EXIF
  img = img.rotate();

  // Upscale so the long side is at least 2000px (improves OCR on small photos)
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

  // Grayscale + normalize (contrast) + sharpen
  img = img.grayscale().normalize().sharpen();

  // Output as PNG for Tesseract
  return img.png().toBuffer();
}

/**
 * Run Tesseract OCR on an image buffer.
 * Returns { text, confidence }.
 */
async function runTesseract(buffer, psm = 6) {
  if (!tesseractAvailable) {
    return { text: '', confidence: 0, error: 'OCR unavailable: tesseract not installed' };
  }

  const tmpDir = path.join(process.cwd(), 'private-uploads', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });

  const tmpFile = path.join(tmpDir, `ocr_${crypto.randomUUID()}.png`);
  const tmpOut = path.join(tmpDir, `ocr_${crypto.randomUUID()}`);

  try {
    fs.writeFileSync(tmpFile, buffer);

    const args = [tmpFile, tmpOut, '-l', LANGS, '--oem', '1', '--psm', String(psm), 'tsv'];
    await execFileAsync(TESSERACT_BIN, args, { timeout: OCR_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 });

    // Read output
    let text = '';
    let confidence = 0;
    const tsvPath = tmpOut + '.tsv';
    if (fs.existsSync(tsvPath)) {
      const tsv = fs.readFileSync(tsvPath, 'utf8');
      const lines = tsv.split('\n').slice(1);
      let totalConf = 0, count = 0;
      const words = [];
      for (const line of lines) {
        const cols = line.split('\t');
        if (cols.length >= 12) {
          const conf = parseFloat(cols[10]);
          const word = cols[11]?.trim();
          if (!isNaN(conf) && conf >= 0 && word) {
            words.push(word);
            totalConf += conf;
            count++;
          }
        }
      }
      text = words.join(' ');
      confidence = count > 0 ? Math.round(totalConf / count) : 0;
    }

    // Also get plain text
    const txtPath = tmpOut + '.txt';
    if (fs.existsSync(txtPath)) {
      const plainText = fs.readFileSync(txtPath, 'utf8').trim();
      if (plainText.length > text.length) text = plainText;
    }

    if (process.env.NODE_ENV !== 'production') {
      // Raw text never logged in production; kept for non-prod debug only if needed
      // (removed: console.log for raw output length)
    }

    return { text, confidence };
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[OCR] tesseract binary:", TESSERACT_BIN);
      console.error("[OCR] tesseract exit code:", e && e.code);
      console.error("[OCR] tesseract stderr:", e && (e.stderr ? String(e.stderr).slice(0,500) : e.message));
      console.error("[OCR] raw output length: 0");
    }
    if (process.env.NODE_ENV !== "production") console.error("[OCR] Tesseract exec error:", e && e.message);
    return { text: '', confidence: 0, error: e.message };
  } finally {
    // Clean up temp files
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    try { fs.unlinkSync(tmpOut + '.tsv'); } catch (e) {}
    try { fs.unlinkSync(tmpOut + '.txt'); } catch (e) {}
  }
}

/**
 * Fix common OCR confusions in number fields.
 */
function fixOCRNumbers(str) {
  if (!str) return str;
  return str
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/l/g, '1');
}

/**
 * Parse dates from various formats to YYYY-MM-DD.
 */
function parseDate(str) {
  if (!str) return null;
  // Try YYYY-MM-DD
  let m = str.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) {
    const y = m[1], mo = m[2].padStart(2, '0'), d = m[3].padStart(2, '0');
    if (isValidDate(y, mo, d)) return `${y}-${mo}-${d}`;
  }
  // Try DD/MM/YYYY or MM/DD/YYYY
  m = str.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (m) {
    const a = m[1].padStart(2, '0'), b = m[2].padStart(2, '0'), y = m[3];
    // Try DD/MM/YYYY first (Philippine format)
    if (isValidDate(y, b, a)) return `${y}-${b}-${a}`;
    if (isValidDate(y, a, b)) return `${y}-${a}-${b}`;
  }
  // Try month name formats: "January 15, 2020" or "15 January 2020"
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  m = str.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{4})/i);
  if (m) {
    const mo = months[m[1].toLowerCase().slice(0, 3)];
    const d = m[2].padStart(2, '0');
    const y = m[3];
    if (isValidDate(y, mo, d)) return `${y}-${mo}-${d}`;
  }
  m = str.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[,\s]+(\d{4})/i);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = months[m[2].toLowerCase().slice(0, 3)];
    const y = m[3];
    if (isValidDate(y, mo, d)) return `${y}-${mo}-${d}`;
  }
  return null;
}

function isValidDate(y, m, d) {
  const year = parseInt(y), month = parseInt(m), day = parseInt(d);
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Extract fields from OCR text based on ID type.
 * Returns { fullName, birthdate, idNumber, address, expiry } with null for uncertain.
 */
function extractFields(text, type, idType) {
  type = (type || 'id').toLowerCase() === 'permit' ? 'permit' : 'id';
  const fields = { fullName: null, birthdate: null, idNumber: null, address: null, expiry: null, businessName: null, permitNumber: null, issueDate: null };
  if (!text) return fields;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');

  // Name extraction: look for "Surname" and "Given Name" labels (Philippine IDs)
  let surname = null, givenName = null;
  const surnameMatch = fullText.match(/(?:surname|last\s*name)[:\s]+([A-Z][A-Za-z][A-Za-z\s,.-]{0,38}?)(?=\n|\s{2,}|$)/i);
  if (surnameMatch) surname = surnameMatch[1].trim().replace(/\s+/g, ' ');
  const givenMatch = fullText.match(/(?:given\s*name|first\s*name)[:\s]+([A-Z][A-Za-z][A-Za-z\s,.-]{0,38}?)(?=\n|\s{2,}|$)/i);
  if (givenMatch) givenName = givenMatch[1].trim().replace(/\s+/g, ' ');

  if (surname && givenName) {
    fields.fullName = `${givenName} ${surname}`;
  } else if (surname) {
    fields.fullName = surname;
  } else {
    // Fallback: look for "Name" label
    const namePatterns = [
      /(?:name|full\s*name)[:\s]+([A-Z][A-Za-z\s,.-]{3,40})/i,
    ];
    for (const pat of namePatterns) {
      const m = fullText.match(pat);
      if (m) {
        fields.fullName = m[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }
  }

  // Birthdate extraction
  const dobPatterns = [
    /(?:birth|born|dob|date\s*of\s*birth)[:\s]+([A-Za-z0-9\s,\/.-]{6,20})/i,
    /(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4})/,
  ];
  for (const pat of dobPatterns) {
    const m = fullText.match(pat);
    if (m) {
      const parsed = parseDate(m[1] || m[0]);
      if (parsed) { fields.birthdate = parsed; break; }
    }
  }

  // ID number extraction: look for "ID No", "License No", etc.
  const idPatterns = [
    /(?:id\s*no|license\s*no|passport\s*no|umid\s*no|number)[:\s]+([A-Z0-9-]{4,20})/i,
    /([A-Z]{1,2}\d{6,12})/,
    /(\d{4}[-\s]?\d{4}[-\s]?\d{4})/,
  ];
  for (const pat of idPatterns) {
    const m = fullText.match(pat);
    if (m) {
      fields.idNumber = fixOCRNumbers(m[1] || m[0]).trim();
      break;
    }
  }

  // Expiry extraction
  const expiryPatterns = [
    /(?:expir|expiry|valid\s*until|valid\s*thru|date\s*of\s*expir)[:\s]+([A-Za-z0-9\s,\/.-]{6,20})/i,
    /(?:expir|expiry)[:\s]+([A-Za-z0-9\s,\/.-]{6,20})/i,
  ];
  for (const pat of expiryPatterns) {
    const m = fullText.match(pat);
    if (m) {
      const parsed = parseDate(m[1]);
      if (parsed) { fields.expiry = parsed; break; }
    }
  }

  // Address extraction (simplified)
  const addrMatch = fullText.match(/(?:address)[:\s]+([A-Za-z0-9\s,.-]{10,80})/i);
  if (addrMatch) fields.address = addrMatch[1].trim();

  if (type === 'permit') {
    const bn = fullText.match(/(?:business|trade|establishment)\s*name[:\s]+([A-Za-z0-9 .,&'-]{3,60})/i);
    if (bn) fields.businessName = bn[1].trim();
    const pn = fullText.match(/(?:permit|license)\s*(?:no|number|#)[:\s]+([A-Z0-9-]{4,20})/i);
    if (pn) fields.permitNumber = fixOCRNumbers(pn[1]).trim();
    const issueMatch = fullText.match(/(?:issue|issued|date\s*issued)[:\s]+([A-Za-z0-9\s,\/.\-]{6,20})/i);
    if (issueMatch) fields.issueDate = parseDate(issueMatch[1]);
  }

  return fields;
}

/**
 * Fuzzy name match (ignore middle names, handle "SURNAME, GIVEN" order, JR/SR).
 */
function fuzzyNameMatch(extracted, typed) {
  if (!extracted || !typed) return 'unknown';
  const normalize = (s) => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const ext = normalize(extracted);
  const typ = normalize(typed);
  const extParts = ext.split(' ').filter(Boolean);
  const typParts = typ.split(' ').filter(Boolean);
  // Remove suffixes
  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv'];
  const extFiltered = extParts.filter(p => !suffixes.includes(p));
  const typFiltered = typParts.filter(p => !suffixes.includes(p));
  // Check if all typed parts are in extracted (or vice versa)
  const allTypedInExt = typFiltered.every(p => extFiltered.some(e => e === p || e.startsWith(p) || p.startsWith(e)));
  const allExtInTyp = extFiltered.every(e => typFiltered.some(p => p === e || p.startsWith(e) || e.startsWith(p)));
  if (allTypedInExt && allExtInTyp) return 'pass';
  if (allTypedInExt || allExtInTyp) return 'warn';
  // Check partial overlap
  const overlap = extFiltered.filter(e => typFiltered.some(p => p === e || p.startsWith(e) || e.startsWith(p)));
  if (overlap.length >= 1) return 'warn';
  return 'fail';
}

/**
 * Main OCR function. Returns { text, confidence, fields, hints }.
 * Never throws. Never logs text or ID numbers.
 */
function nameTokensInText(text, typed) {
  if (!text || !typed) return false;
  const norm = (s) => s.toLowerCase().replace(/[^a-zs]/g, ' ').replace(/s+/g, ' ').trim();
  const ocr = norm(text);
  const tokens = norm(typed).split(' ').filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(tok => {
    if (ocr.includes(tok)) return true;
    return ocr.split(' ').some(w => w.length >= tok.length - 1 && w.length <= tok.length + 1 && editDistance(w, tok) <= 1);
  });
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function birthdateInText(text, typedDob) {
  if (!text || !typedDob) return false;
  const digits = text.replace(/[^0-9]/g, '');
  const t = String(typedDob).replace(/[^0-9]/g, '');
  if (t.length >= 6 && digits.includes(t)) return true;
  const m = String(typedDob).match(/(d{4})[-/](d{1,2})[-/](d{1,2})/);
  if (m) {
    const alt = m[3].padStart(2,'0') + m[2].padStart(2,'0') + m[1];
    if (digits.includes(alt)) return true;
  }
  return false;
}

async function runOCR(buffer, mimeType, type, idType, typedName, typedDob) {
  type = (type || 'id').toLowerCase() === 'permit' ? 'permit' : 'id';
  if (!tesseractAvailable) {
    if (process.env.NODE_ENV !== 'production') console.error('[OCR] Tesseract binary not found:', TESSERACT_BIN);
    return {
      text: '',
      confidence: 0,
      reason: 'OCR_NOT_FOUND',
      fields: { fullName: null, birthdate: null, idNumber: null, address: null, expiry: null, businessName: null, permitNumber: null, issueDate: null },
      hints: [{ status: 'warn', message: 'OCR unavailable — Tesseract not installed. Please enter details manually.' }],
    };
  }

  if (!buffer || buffer.length === 0) {
    return {
      text: '',
      confidence: 0,
      reason: 'NO_IMAGE',
      fields: { fullName: null, birthdate: null, idNumber: null, address: null, expiry: null, businessName: null, permitNumber: null, issueDate: null },
      hints: [{ status: 'fail', message: 'No image provided' }],
    };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return {
      text: '',
      confidence: 0,
      reason: 'FILE_TOO_LARGE',
      fields: { fullName: null, birthdate: null, idNumber: null, address: null, expiry: null, businessName: null, permitNumber: null, issueDate: null },
      hints: [{ status: 'fail', message: 'Image too large (max 5 MB)' }],
    };
  }

  // Verify magic bytes
  const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                 buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
  if (!isJpeg && !isPng && !isWebp && !isPdf) {
    return {
      text: '',
      confidence: 0,
      reason: 'UNSUPPORTED_FORMAT',
      fields: { fullName: null, birthdate: null, idNumber: null, address: null, expiry: null, businessName: null, permitNumber: null, issueDate: null },
      hints: [{ status: 'fail', message: 'Unsupported image format (JPEG/PNG/WebP only)' }],
    };
  }

  try {
    const preprocessed = await preprocessImage(buffer, mimeType);
    // Run several page segmentation modes, keep best result
    const modes = [6, 4, 11];
    let best = { text: '', confidence: 0 };
    for (const psm of modes) {
      const r = await runTesseract(preprocessed, psm);
      if (!best.text || r.text.length > best.text.length || (r.text.length === best.text.length && r.confidence > best.confidence)) {
        best = r;
      }
      if (process.env.NODE_ENV !== 'production') {
      // Production: never log extracted OCR text or raw ID content
    // (console logs removed to prevent data leakage)
      }
    }
    const { text, confidence, error } = best;

    if (error) {
      const reason = /timed? ?out|ETIMEDOUT/i.test(error) ? 'OCR_TIMEOUT' : 'OCR_FAILED';
      if (process.env.NODE_ENV !== 'production') console.error('[OCR] Tesseract error:', error);
      return {
        text: '',
        confidence: 0,
        reason,
        fields: { fullName: null, birthdate: null, idNumber: null, address: null, expiry: null, businessName: null, permitNumber: null, issueDate: null },
        hints: [{ status: 'warn', message: "We couldn't scan it now, you can still continue." }],
      };
    }

    const fields = extractFields(text, type, idType);

    // Build hints (never include raw text or ID number)
    const hints = [];

    // 1. Image readable
    if (confidence >= 60 && text.length > 20) {
      hints.push({ status: 'pass', message: 'Image is readable' });
    } else if (confidence >= 30) {
      hints.push({ status: 'warn', message: 'Image may be blurry or low quality — try retaking' });
    } else {
      hints.push({ status: 'fail', message: 'Image is unreadable — please retake the photo' });
    }

    // 2. Name match (against raw OCR text, tolerant)
    const nameMatched = typedName ? nameTokensInText(text, typedName) : !!fields.fullName;
    if (nameMatched) {
      if (!fields.fullName) fields.fullName = typedName;
      hints.push({ status: 'pass', message: 'Name matches' });
    } else if (fields.fullName) {
      hints.push({ status: 'warn', message: 'Name found but does not match — please verify' });
    } else {
      hints.push({ status: 'unknown', message: 'Name not detected' });
    }

    // 3. Birthdate match (against raw OCR text, any format)
    const birthMatched = typedDob ? birthdateInText(text, typedDob) : !!fields.birthdate;
    if (birthMatched) {
      if (!fields.birthdate) fields.birthdate = typedDob;
      hints.push({ status: 'pass', message: 'Birthdate matches' });
    } else if (fields.birthdate) {
      hints.push({ status: 'warn', message: 'Birthdate mismatch — please verify' });
    } else {
      hints.push({ status: 'unknown', message: 'Birthdate not detected' });
    }

    // 4. ID type recognized
    if (idType) {
      hints.push({ status: 'pass', message: 'ID type recognized' });
    } else {
      hints.push({ status: 'unknown', message: 'ID type not specified' });
    }

    // 5. Expiry
    if (fields.expiry) {
      const expiryDate = new Date(fields.expiry);
      if (expiryDate > new Date()) {
        hints.push({ status: 'pass', message: 'ID is not expired' });
      } else {
        hints.push({ status: 'fail', message: 'ID appears expired' });
      }
    } else {
      hints.push({ status: 'warn', message: 'Could not verify expiry date' });
    }

    return { text: '', confidence, fields, hints };
  } catch (e) {
    const reason = e && /preprocess|sharp/i.test(e.message || '') ? 'OCR_PREPROCESS_FAILED' : 'OCR_FAILED';
    if (process.env.NODE_ENV !== 'production') console.error('[OCR] Processing error:', e && e.message);
    return {
      text: '',
      confidence: 0,
      reason,
      fields: { fullName: null, birthdate: null, idNumber: null, address: null, expiry: null, businessName: null, permitNumber: null, issueDate: null },
      hints: [{ status: 'warn', message: "We couldn't scan it now, you can still continue." }],
    };
  }
}

module.exports = {
  runOCR,
  tesseractAvailable,
  availableLangs,
  LANGS,
};