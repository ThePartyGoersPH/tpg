// Display-only formatting helpers for bar details.
// These never mutate stored data or API payloads — they only shape text
// for rendering (dedupe repeated address segments, group hours rows).

// Split address-ish fields on commas, trim, and drop case-insensitive
// duplicates while keeping first-seen order.
// e.g. "Cavite, Calabarzon, 4114, Philippines, Cavite, Cavite"
//   -> ["Cavite", "Calabarzon", "4114", "Philippines"]
export function dedupeAddressSegments(...parts) {
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    for (const seg of String(part ?? '').split(',')) {
      const t = seg.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

// Full display address: every unique segment (street, barangay, city,
// province, postcode, country) in stored order.
export function formatFullAddress(bar) {
  if (!bar) return '';
  return dedupeAddressSegments(bar.address, bar.city, bar.state).join(', ');
}

// Short display address for tight spaces (hero): street/barangay + city.
export function formatShortAddress(bar) {
  if (!bar) return '';
  const segs = dedupeAddressSegments(bar.address, bar.city, bar.state);
  if (!segs.length) return '';
  const city = String(bar.city || '').trim();
  if (!city || segs[0].toLowerCase() === city.toLowerCase()) return segs[0];
  return `${segs[0]}, ${city}`;
}

const DAY_ABBR = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

// Normalise one day's hours for grouping: trimmed string, or null when
// the day is closed / unavailable / missing.
function normaliseDayHours(hrs) {
  const t = String(hrs ?? '').trim();
  if (!t || /unavailable/i.test(t)) return null;
  return t;
}

// Group CONSECUTIVE days with identical hours.
// openingHours: [[dayName, hours], ...] in Monday..Sunday order.
// Returns [{ days: [...], key: string|null, display: string }].
export function groupOpeningHours(openingHours) {
  const groups = [];
  for (const [day, hrs] of openingHours || []) {
    const key = normaliseDayHours(hrs);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], key, display: key || 'Closed' });
    }
  }
  return groups;
}

// "Monday" -> "Monday", ["Monday","Tuesday","Wednesday"] -> "Mon – Wed".
export function groupDayLabel(days) {
  if (!days || !days.length) return '';
  if (days.length === 1) return days[0];
  return `${DAY_ABBR[days[0]] || days[0]} – ${DAY_ABBR[days[days.length - 1]] || days[days.length - 1]}`;
}
