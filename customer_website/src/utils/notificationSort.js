// Keeps notification lists strictly newest-first regardless of which source
// produced them (API ordering, merged payloads, optimistic updates).
// Ties on created_at are broken by id descending so the order is stable.

function toTime(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const s = String(value);
  // Bare MySQL datetimes carry no offset; the backend treats them as UTC, so
  // match that here or they would sort against ISO-8601 values incorrectly.
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/Z|[+-]\d{2}:?\d{2}$/.test(s)
    ? s.replace(' ', 'T') + 'Z'
    : s;
  const t = Date.parse(normalized);
  return Number.isNaN(t) ? 0 : t;
}

export function sortNotifications(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const diff = toTime(b?.created_at) - toTime(a?.created_at);
    if (diff !== 0) return diff;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });
}
