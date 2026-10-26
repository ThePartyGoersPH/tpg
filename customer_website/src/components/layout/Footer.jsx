function Footer() {
  const buildVersion = import.meta.env.VITE_BUILD_VERSION || import.meta.env.VITE_APP_VERSION || 'dev';
  return (
    <footer className="footer-wrap">
      <div className="container footer">
        <p>Platform Bar System - Customer Website</p>
        <p className="section-subtitle">Discover bars, events, and reserve your next night out.</p>
        <p className="section-subtitle" style={{ fontSize: '0.7rem', opacity: 0.5 }}>Build: {buildVersion}</p>
      </div>
    </footer>
  );
}

export default Footer;
