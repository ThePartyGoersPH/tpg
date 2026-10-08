const normalizeBarTypeValue = (value) => {
  const label = String(value || '').trim();
  if (!label) return [];

  const lower = label.toLowerCase();
  if (lower === 'bar / club' || lower === 'bar/club') return ['Bar', 'Club'];
  if (lower === 'restobar') return ['Restobar'];
  if (lower === 'club') return ['Club'];
  if (lower === 'comedy bar') return ['Comedy Bar'];
  if (lower === 'ktv') return ['KTV'];
  if (lower === 'bar') return ['Bar'];
  return [label];
};

export function getBarTypes(bar) {
  const rawBarTypes = bar?.bar_types;
  let parsed = [];

  if (Array.isArray(rawBarTypes)) {
    parsed = rawBarTypes;
  } else if (typeof rawBarTypes === 'string' && rawBarTypes.trim()) {
    try {
      const json = JSON.parse(rawBarTypes);
      parsed = Array.isArray(json) ? json : [rawBarTypes];
    } catch {
      parsed = [rawBarTypes];
    }
  }

  const normalized = [...new Set(parsed.flatMap(normalizeBarTypeValue))];
  if (normalized.length) return normalized;

  const fallbackCategory = String(bar?.category || '').trim();
  if (!fallbackCategory) return [];
  return normalizeBarTypeValue(fallbackCategory);
}

export function getPrimaryBarType(bar) {
  return getBarTypes(bar)[0] || 'Bar';
}
