export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(value) {
  if (!value) return '-';
  const raw = value.length === 5 ? `${value}:00` : value;
  const date = new Date(`1970-01-01T${raw}`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
