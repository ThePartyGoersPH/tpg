function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="card" role="status" aria-live="polite">
      {label}
    </div>
  );
}

export default LoadingState;
