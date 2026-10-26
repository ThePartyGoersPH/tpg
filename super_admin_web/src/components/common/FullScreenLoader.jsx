// Single full-screen loader shown while the auth session is resolving.
// Rendered INSTEAD of routes (never alongside), so session restore can
// never flash the login page, the layout, or competing spinners.
export default function FullScreenLoader({ label = 'Restoring session…' }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: '100dvh', background: 'var(--sa-bg, #0f0a1a)' }}
      role="status"
      aria-label={label}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div
          className="animate-spin"
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '9999px',
            border: '3px solid rgba(220, 38, 38, 0.2)',
            borderTopColor: '#dc2626',
          }}
        />
        <span style={{ fontSize: '0.85rem', color: 'var(--sa-text-dim, rgba(240,240,245,0.6))' }}>
          {label}
        </span>
      </div>
    </div>
  );
}
