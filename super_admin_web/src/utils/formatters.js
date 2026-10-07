import { formatDistanceToNow } from 'date-fns';

const parseDateValue = (value) => {
  if (!value) return null;
  let str = String(value).trim();

  // MySQL datetime values have no timezone; treat as UTC to avoid offset drift.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(str) && !/Z|[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }

  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
};

export const formatDate = (date) => {
  if (!date) return 'N/A';
  const parsed = parseDateValue(date);
  if (!parsed) return String(date);
  return parsed.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  const parsed = parseDateValue(date);
  if (!parsed) return String(date);
  return parsed.toLocaleString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatRelativeTime = (date) => {
  if (!date) return 'N/A';
  const parsed = parseDateValue(date);
  if (!parsed) return String(date);
  return formatDistanceToNow(parsed, { addSuffix: true });
};

export const formatCurrentDateLabel = (value = new Date()) => {
  const parsed = parseDateValue(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatPercentage = (value) => {
  if (value === null || value === undefined) return '0%';
  return `${Number(value).toFixed(2)}%`;
};

export const getStatusColor = (status) => {
  const colors = {
    active: 'green',
    approved: 'green',
    completed: 'green',
    paid: 'green',
    pending: 'amber',
    processing: 'blue',
    rejected: 'red',
    failed: 'red',
    suspended: 'gray',
    cancelled: 'gray',
    expired: 'gray',
  };
  return colors[status?.toLowerCase()] || 'gray';
};

export const getStatusText = (status) => {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};
