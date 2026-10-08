import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'superadmin.theme';

function initialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable — fall through to OS preference
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function useAppTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f2ec' : '#1a0a0a');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage unavailable — theme applies for this session only
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const chart = theme === 'light'
    ? { tick: '#57534e', grid: 'rgba(0,0,0,0.08)', tooltipBg: '#ffffff', tooltipText: '#1c1917' }
    : { tick: '#a8a29e', grid: 'rgba(255,255,255,0.08)', tooltipBg: '#1c1016', tooltipText: '#fafaf9' };

  return { theme, setTheme, toggleTheme, isLight: theme === 'light', chart };
}

export default useAppTheme;
