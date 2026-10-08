/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH — required permit documents for a bar registration.
 *
 * Every side of the app reads this one list:
 *   • Bar Owner portal  (manager)   → upload buttons, live checklist, counters
 *   • Super Admin       (review)    → Permit Checking panel, approval gates
 *   • Permit Monitoring             → per-bar document status
 *   • Customer visibility gate      → compliance document counts
 *
 * There is intentionally NO second hardcoded list anywhere: add a permit here
 * and it appears on the owner form, in Permit Checking, and in every count.
 *
 * Two key spaces exist because the data was stored twice over time:
 *   • `key`          → owner form field name / `bar_registration_documents.document_type`
 *   • `legacyColumn` → `business_registrations` column AND
 *                      `business_registration_document_reviews.document_type`
 * `portalTypes` lists every name the portal side may have used for this permit,
 * so a file uploaded under an older alias is still resolved.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const REQUIRED_PERMITS = [
  { key: "bir_certificate", label: "BIR Registration", legacyColumn: "bir_certificate", portalTypes: ["bir_certificate"] },
  { key: "mayors_permit", label: "Mayor's Permit", legacyColumn: "mayors_permit", portalTypes: ["mayors_permit"] },
  { key: "sanitary_permit", label: "Sanitary Permit", legacyColumn: "sanitary_permit", portalTypes: ["sanitary_permit"] },
  { key: "business_plate_permit", label: "Business Plate / Permit", legacyColumn: "business_permit", portalTypes: ["business_plate_permit", "business_permit"] },
  { key: "fire_safety_certificate", label: "Fire Safety Inspection Certificate", legacyColumn: "fire_safety_certificate", portalTypes: ["fire_safety_certificate"] },
  { key: "tobacco_liquor_permit", label: "Tobacco & Liquor Permit", legacyColumn: "liquor_license", portalTypes: ["tobacco_liquor_permit", "liquor_license"] },
  { key: "selfie_with_id", label: "Selfie with ID", legacyColumn: "selfie_with_id", portalTypes: ["selfie_with_id"] },
];

// Portal keys — multer field names, checklist items, `bar_registration_documents.document_type`.
const PORTAL_DOC_TYPES = REQUIRED_PERMITS.map((permit) => permit.key);

// Registration keys — `business_registrations` columns + review `document_type`.
const REGISTRATION_DOC_KEYS = REQUIRED_PERMITS.map((permit) => permit.legacyColumn);

// Every permit on this list must be on file before a bar can be approved.
const REQUIRED_COUNT = REQUIRED_PERMITS.length;

const DOC_LABELS = Object.fromEntries(REQUIRED_PERMITS.map((permit) => [permit.key, permit.label]));
const REGISTRATION_DOC_LABELS = Object.fromEntries(REQUIRED_PERMITS.map((permit) => [permit.legacyColumn, permit.label]));
const LEGACY_DOC_COLUMNS = Object.fromEntries(REQUIRED_PERMITS.map((permit) => [permit.key, permit.legacyColumn]));
const PORTAL_TYPES_BY_REGISTRATION_KEY = Object.fromEntries(
  REQUIRED_PERMITS.map((permit) => [permit.legacyColumn, permit.portalTypes])
);

// The compliance queue's document rows: one entry per required permit.
const COMPLIANCE_DOCUMENTS = REQUIRED_PERMITS.map((permit) => ({
  key: permit.key,
  label: permit.label,
  legacyColumn: permit.legacyColumn,
}));

const permitByKey = (key) => REQUIRED_PERMITS.find((permit) => permit.key === key) || null;

// Accepts a portal key OR a registration key and returns one label.
const labelFor = (key) => DOC_LABELS[key] || REGISTRATION_DOC_LABELS[key] || key;

const registrationKeyFor = (key) => LEGACY_DOC_COLUMNS[key] || key;

// Shape handed to the Bar Owner portal (labels + keys only — no internals).
const publicPermitList = () =>
  REQUIRED_PERMITS.map((permit) => ({ key: permit.key, label: permit.label, required: true }));

module.exports = {
  REQUIRED_PERMITS,
  PORTAL_DOC_TYPES,
  REGISTRATION_DOC_KEYS,
  REQUIRED_COUNT,
  COMPLIANCE_DOCUMENTS,
  DOC_LABELS,
  REGISTRATION_DOC_LABELS,
  LEGACY_DOC_COLUMNS,
  PORTAL_TYPES_BY_REGISTRATION_KEY,
  permitByKey,
  labelFor,
  registrationKeyFor,
  publicPermitList,
};
