import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle({ className = '', showLabel = false }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        padding: showLabel ? '0.45rem 0.85rem' : '0.45rem',
        borderRadius: '50px',
        background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
        border: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
        color: 'var(--color-text-primary, #ffffff)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {isLight ? (
        <Moon size={18} strokeWidth={2} style={{ color: '#6366f1' }} />
      ) : (
        <Sun size={18} strokeWidth={2} style={{ color: '#f59e0b' }} />
      )}
      {showLabel && (
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
          {isLight ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  );
}

export default ThemeToggle;
