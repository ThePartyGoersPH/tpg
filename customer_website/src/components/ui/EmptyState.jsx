function EmptyState({ title = 'No data yet.', subtitle = '' }) {
  return (
    <div className="card card-muted">
      <p className="section-title" style={{ fontSize: '1rem' }}>
        {title}
      </p>
      {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
    </div>
  );
}

export default EmptyState;
