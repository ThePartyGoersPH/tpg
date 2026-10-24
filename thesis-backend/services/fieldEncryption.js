const crypto = require("crypto");

/**
 * AES-256-GCM at-rest encryption for the PayMongo secrets stored on `bars`.
 *
 * Design notes:
 *  - The key lives ONLY in the environment (PAYMONGO_FIELD_ENCRYPTION_KEY),
 *    never in the database, so reading the DB dump does not yield plaintext.
 *  - Ciphertext is self-describing (`enc:v1:<iv>:<tag>:<ct>`), so a value that
 *    does not carry the prefix is treated as legacy plaintext and passed
 *    through unchanged. That keeps every already-stored row readable without a
 *    backfill and lets a rollout be reversed by simply removing the env var.
 *  - Decryption happens at the single moment the plaintext is needed (webhook
 *    verification / an outgoing PayMongo call) and nowhere else. No decrypted
 *    value is ever logged.
 */

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

let warnedMissingKey = false;

function warnMissingKey() {
  if (warnedMissingKey) return;
  warnedMissingKey = true;
  console.warn(
    "PAYMONGO_FIELD_ENCRYPTION_KEY is not set — bar secrets are being stored in PLAINTEXT. " +
      "Add a base64-encoded 32-byte key to .env to enable encryption at rest."
  );
}

function getKey() {
  const raw = String(process.env.PAYMONGO_FIELD_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    warnMissingKey();
    return null;
  }
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    // Loud and non-fatal: the app still runs, but we refuse to pretend the
    // column is encrypted when the key cannot possibly work.
    console.error(
      "PAYMONGO_FIELD_ENCRYPTION_KEY does not decode to 32 bytes — falling back to plaintext storage."
    );
    return null;
  }
  return key;
}

function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function encryptionEnabled() {
  return Boolean(getKey());
}

/**
 * Returns ciphertext, or the input unchanged when no usable key is configured.
 * Idempotent: an already-encrypted value is returned as-is.
 */
function encryptField(plain) {
  if (plain === null || plain === undefined || plain === "") return plain;
  const text = String(plain);
  if (isEncrypted(text)) return text;

  const key = getKey();
  if (!key) return text;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Returns plaintext. Legacy (unencrypted) values pass through untouched.
 *
 * Fail-closed: if the value is ciphertext but no key is available, or the tag
 * does not verify, the caller gets null rather than a wrong/guessed secret.
 * The secret itself is never included in any log line.
 */
function decryptField(value) {
  if (value === null || value === undefined || value === "") return value;
  const text = String(value);
  if (!isEncrypted(text)) return text;

  const key = getKey();
  if (!key) {
    console.error("FIELD_ENCRYPT: cannot decrypt a stored value without PAYMONGO_FIELD_ENCRYPTION_KEY");
    return null;
  }

  const [ivB64, tagB64, ctB64] = text.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !ctB64) {
    console.error("FIELD_ENCRYPT: malformed ciphertext (missing iv/tag/ciphertext segment)");
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    console.error(
      `FIELD_ENCRYPT: decryption failed (wrong key or corrupted value): ${err.message}`
    );
    return null;
  }
}

module.exports = {
  encryptField,
  decryptField,
  isEncrypted,
  encryptionEnabled,
  // Exposed for tests: the ciphertext envelope shape.
  CIPHERTEXT_PREFIX: PREFIX,
};
