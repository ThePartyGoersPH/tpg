import { ArrowLeft } from 'lucide-react';

const BackButton = ({
  onClick,
  className,
  ...rest
}) => {
  const cls = className || '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`button secondary ${cls}`}
      style={{
        minWidth: 120,
        width: 'auto',
        height: 52,
        border: '1.5px solid var(--color-border)',
        color: 'var(--color-text-primary)',
        background: 'transparent',
        borderRadius: 12,
        fontFamily: "'Sora', sans-serif",
        fontSize: '0.875rem',
        fontWeight: 600,
        alignItems: 'center',
        display: 'flex',
        gap: '0.5rem',
        padding: '0 1rem',
        cursor: 'pointer',
        transition: 'background 0.2s, border-color 0.2s',
        ':hover': {
          background: 'rgba(23, 20, 18, 0.04)',
          borderColor: 'var(--color-border)',
        },
        '&:focus-visible': {
          outline: 'none',
          borderColor: 'var(--color-accent-primary)',
          boxShadow: '0 0 0 2px var(--color-accent-primary), 0 0 0 4px var(--color-bg)',
        },
        ':active': {
          transform: 'scale(0.98)',
        },
      }}
      {...rest}
    >
      <ArrowLeft width={14} height={14} />Back</button>
  );
};

export default BackButton;
export { BackButton };