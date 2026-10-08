import { createContext, useEffect, useState } from 'react';

export const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    } catch (_) {
      // fallback if localStorage disabled
    }
    // Respect OS preference on first load (no flash: initial paint uses
    // data-theme set inline in index.html from the same rule).
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Keep the browser UI (status bar / tab bar) in sync with the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#f6f4ef' : '#0A0A0A');
    }
    try {
      localStorage.setItem('theme', theme);
    } catch (_) {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
