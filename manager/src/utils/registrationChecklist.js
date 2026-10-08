// Checklist for the Bar Registration requirements.
//
// The list of required permit documents is NOT defined here: it is owned by
// thesis-backend/config/requiredPermits.js and handed over by
// GET /bar-registration/current (`required_permits`). The form, the portal-wide
// banner and Super Admin's Permit Checking panel therefore all render the same
// list — adding a permit on the backend makes it appear everywhere.

export const REQUIRED_FIELDS = [
  ['business_name', 'Business Name'],
  ['business_address', 'Business Address'],
  ['business_city', 'Business City'],
  ['business_phone', 'Business Phone'],
  ['owner_first_name', 'Owner First Name'],
  ['owner_last_name', 'Owner Last Name'],
  ['owner_email', 'Owner Email'],
  ['owner_phone', 'Owner Phone'],
];

// Last list received from the backend — lets helpers that run outside React
// (toasts, review details) resolve a label without threading props everywhere.
let cachedPermits = [];

export function setRequiredPermits(permits) {
  cachedPermits = Array.isArray(permits) ? permits : [];
  return cachedPermits;
}

export function getRequiredPermits() {
  return cachedPermits;
}

export function docLabel(key, permits) {
  const list = Array.isArray(permits) && permits.length ? permits : cachedPermits;
  const hit = list.find((permit) => permit.key === key);
  if (hit) return hit.label;
  return String(key || '').replaceAll('_', ' ');
}

/**
 * Builds the live checklist.
 *  - saved:  DB state from GET /bar-registration/current ({ fields, documents })
 *  - form:   values typed on the current visit (empty when only reading state)
 *  - files:  documents attached on the current visit
 *  - permits: required permit documents from the backend (required_permits)
 * An item counts as done when it is already saved OR filled in right now.
 */
export function evaluateChecklist({ saved = {}, form = {}, files = {}, permits = [] } = {}) {
  const savedFields = saved.fields || {};
  const savedDocs = saved.documents || {};
  const permitList = Array.isArray(permits) && permits.length ? permits : cachedPermits;

  const fieldItems = REQUIRED_FIELDS.map(([key, label]) => ({
    key,
    label,
    done: Boolean(String(form[key] || '').trim()) || Boolean(savedFields[key]),
  }));

  const docItems = permitList.map((permit) => ({
    key: permit.key,
    label: permit.label,
    done: Boolean(files[permit.key]) || Boolean(savedDocs[permit.key]),
  }));

  const missingFields = fieldItems.filter((i) => !i.done);
  const missingDocs = docItems.filter((i) => !i.done);

  return {
    fieldItems,
    docItems,
    missingFields,
    missingDocs,
    missingCount: missingFields.length + missingDocs.length,
    totalCount: fieldItems.length + docItems.length,
    isComplete: missingFields.length === 0 && missingDocs.length === 0,
  };
}
