// middlewares/uploadFallback.js
// Express middleware that intercepts 404s on /uploads/* paths.
// Instead of returning a raw 404 (which spams mobile debug logs),
// it serves a default avatar image for profile paths, or a
// generic 1x1 transparent PNG for other missing upload files.
//
// This is mounted AFTER express.static("uploads") so it only
// fires when the file truly does not exist on disk.

const path = require("path");
const fs = require("fs");

const DEFAULTS_DIR = path.join(__dirname, "..", "uploads", "defaults");
const DEFAULT_AVATAR = path.join(DEFAULTS_DIR, "avatar.png");

/**
 * Ensure the defaults directory and a minimal default avatar exist.
 * Called once at startup. Uses a tiny valid 1x1 grey PNG if no avatar
 * has been placed manually.
 */
function ensureDefaults() {
  try {
    if (!fs.existsSync(DEFAULTS_DIR)) {
      fs.mkdirSync(DEFAULTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(DEFAULT_AVATAR)) {
      // Minimal valid 1x1 grey (#cccccc) PNG — 68 bytes
      const buf = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4" +
        "nGPY8P8/AwAJAgH/09smGQAAAABJRU5ErkJggg==",
        "base64"
      );
      fs.writeFileSync(DEFAULT_AVATAR, buf);
      console.log("✅ Created default avatar:", DEFAULT_AVATAR);
    }
  } catch (err) {
    console.error("⚠️  Could not create default avatar:", err.message);
  }
}

/**
 * Middleware: catch any request to /uploads/* that was NOT handled by
 * express.static (i.e. the file is missing) and return a fallback image
 * instead of a 404.
 */
function uploadFallback(req, res, next) {
  // Only handle GET requests under /uploads/
  if (req.method !== "GET") return next();

  // Profile images → serve default avatar
  if (req.path.startsWith("/uploads/profiles/") || req.path.startsWith("/uploads/defaults/")) {
    if (fs.existsSync(DEFAULT_AVATAR)) {
      return res.sendFile(DEFAULT_AVATAR);
    }
  }

  // Any other missing upload → 1x1 transparent PNG (no noisy 404)
  if (req.path.startsWith("/uploads/")) {
    // Return a 200 with a tiny transparent 1x1 PNG to avoid client errors
    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12Ng" +
      "AAIABQABNjN9GQAAAABJRU5ErkJggg==",
      "base64"
    );
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=300");
    return res.status(200).send(transparentPng);
  }

  next();
}

module.exports = { uploadFallback, ensureDefaults };
