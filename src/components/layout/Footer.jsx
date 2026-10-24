function Footer() {
  return (
    <footer className="footer-wrap">
      <div className="container footer">
        <p>Platform Bar System - Customer Website</p>
        <p className="section-subtitle">Discover bars, events, and reserve your next night out.</p>
        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Build: {__COMMIT_HASH__}</p>
      </div>
    </footer>
  );
}

export default Footer;
