function normalizeDateValue(value) {
  if (!value) return null;
  let str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(str) && !/Z|[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  return new Date(str);
}

export function formatDate(value) {
  if (!value) return '-';
  const date = normalizeDateValue(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(value) {
  if (!value) return '-';
  const raw = String(value).trim();
  const timeOnly = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  let date = null;

  if (timeOnly) {
    date = new Date();
    date.setHours(Number(timeOnly[1]), Number(timeOnly[2]), Number(timeOnly[3] || 0), 0);
  } else {
    date = normalizeDateValue(raw);
  }

  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = normalizeDateValue(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function fullName(user) {
  if (!user) return 'Guest';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Guest';
}

export function timeAgo(value) {
  if (!value) return '';
  let str = String(value);
  // Bare MySQL datetime strings have no timezone marker — treat as UTC to avoid
  // double-offset bug (Manila UTC+8 browser would add another 8h otherwise)
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(str) && !/Z|[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const diff = Math.floor((Date.now() - new Date(str).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(value);
}
