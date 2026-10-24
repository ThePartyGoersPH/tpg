import { API_BASE_URL } from '../api/client';

export function imageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;

  const normalized = path.startsWith('/') ? path.substring(1) : path;
  if (normalized.startsWith('assets/')) return '';

  return `${API_BASE_URL}/${normalized}`;
}
