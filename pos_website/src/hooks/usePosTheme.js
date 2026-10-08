import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'pos.theme';

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

export function usePosTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f1ea' : '#08090b');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage unavailable — theme applies for this session only
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, setTheme, toggleTheme, isLight: theme === 'light' };
}

export default usePosTheme;
