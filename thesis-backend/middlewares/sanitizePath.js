// middlewares/sanitizePath.js
// Prevents path traversal attacks on upload-related routes.
// Rejects any request whose path parameter contains "..", "~", or
// null bytes — common attack vectors for directory traversal.

const path = require("path");

/**
 * Express middleware factory: sanitize a named route parameter.
 * Usage: router.get("/uploads/:filename", sanitizePath("filename"), handler)
 *
 * @param  {...string} paramNames – route param names to check
 * @returns {import('express').RequestHandler}
 */
function sanitizePath(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const val = req.params[name];
      if (!val) continue;

      const decoded = decodeURIComponent(val);

      // Block directory traversal
      if (decoded.includes("..") || decoded.includes("~") || decoded.includes("\0")) {
        return res.status(400).json({
          success: false,
          message: "Invalid file path"
        });
      }

      // Normalise to just the basename (strip any leading directories)
      req.params[name] = path.basename(decoded);
    }
    next();
  };
}

module.exports = sanitizePath;
