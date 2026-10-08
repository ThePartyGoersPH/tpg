const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTime(token) {
  const t = token.trim().toLowerCase();
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];
  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  if (!period) {
    if (hours >= 1 && hours <= 12) {
      hours = hours <= 12 ? (hours === 12 ? 12 : hours) : hours;
    }
  }
  return hours * 60 + minutes;
}

function parseHoursRange(hoursStr) {
  if (!hoursStr || typeof hoursStr !== 'string') return null;
  const cleaned = hoursStr.replace(/[–—]/g, '-').trim();
  const parts = cleaned.split('-');
  if (parts.length !== 2) return null;
  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  if (start === null || end === null) return null;
  return { start, end };
}

function isCurrentlyOpen(range) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const { start, end } = range;
  if (start <= end) {
    return currentMinutes >= start && currentMinutes < end;
  } else {
    return currentMinutes >= start || currentMinutes < end;
  }
}

export function getBarOpenStatus(bar) {
  if (!bar) return { isOpen: false, label: 'Closed' };
  const today = DAY_NAMES[new Date().getDay()];
  const hoursField = {
    Sunday: bar.sunday_hours,
    Monday: bar.monday_hours,
    Tuesday: bar.tuesday_hours,
    Wednesday: bar.wednesday_hours,
    Thursday: bar.thursday_hours,
    Friday: bar.friday_hours,
    Saturday: bar.saturday_hours,
  }[today];
  if (!hoursField) return { isOpen: false, label: 'Closed' };
  const range = parseHoursRange(hoursField);
  if (!range) return { isOpen: false, label: 'Closed' };
  return { isOpen: isCurrentlyOpen(range), label: isCurrentlyOpen(range) ? 'Open Now' : 'Closed' };
}
