/**
 * Parse a MySQL UTC timestamp string correctly.
 * MySQL returns timestamps as 'YYYY-MM-DD HH:MM:SS' with no timezone indicator.
 * JavaScript's new Date() treats strings without timezone as LOCAL time, causing
 * timestamps to appear 8 hours behind in UTC+8 regions.
 * This function appends 'Z' to force UTC interpretation.
 */
export const parseUTC = (ts) => {
  if (!ts) return null;
  const s = String(ts).trim();
  // Already has timezone info (ISO with Z or offset)
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  // MySQL format: '2026-03-25 06:46:00' → '2026-03-25T06:46:00Z'
  return new Date(s.replace(' ', 'T') + 'Z');
};

export const formatFriendlyDate = (value) => {
  if (!value) return '—';
  const date = parseUTC(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatFriendlyTime = (value) => {
  if (!value) return '—';
  const raw = String(value).trim();
  const timeOnly = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (timeOnly) {
    const d = new Date();
    d.setHours(Number(timeOnly[1]), Number(timeOnly[2]), Number(timeOnly[3] || 0), 0);
    return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const date = parseUTC(raw);
  if (!date || Number.isNaN(date.getTime())) return raw;
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export const formatFriendlyDateTime = (value) => {
  if (!value) return '—';
  const date = parseUTC(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};
