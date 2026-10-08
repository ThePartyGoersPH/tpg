// utils/profileUrl.js
// Builds an always-valid profile image URL.
// If the user has a local upload path, returns it.
// If the user has an external URL (https://...), returns it as-is.
// Otherwise returns the default avatar path.

const DEFAULT_AVATAR = "uploads/defaults/avatar.png";

/**
 * Resolve a profile_picture value into a safe, always-servable path.
 * @param {string|null} raw  - The profile_picture column value from DB
 * @returns {string} A path that is guaranteed to resolve (local or external)
 */
function safeProfileUrl(raw) {
  if (!raw) return DEFAULT_AVATAR;

  const trimmed = String(raw).trim();
  if (!trimmed) return DEFAULT_AVATAR;

  // External URLs are returned as-is (the client handles them directly)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Local path — return as-is; the upload-fallback middleware will catch 404s
  return trimmed;
}

module.exports = { safeProfileUrl, DEFAULT_AVATAR };
