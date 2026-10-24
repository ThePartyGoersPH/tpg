import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const msg = err?.message || String(err);
      const stack = err?.stack || '';
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: '2rem', textAlign: 'center',
          background: 'var(--color-bg-base, #0c0a08)', color: 'var(--color-text-primary, #fff)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--color-text-muted, #888)', fontSize: '0.85rem', maxWidth: 560, margin: '0 0 0.5rem', wordBreak: 'break-word' }}>
            {msg}
          </p>
          {stack && (
            <pre style={{
              textAlign: 'left', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)',
              maxWidth: 600, maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap',
              background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: 8,
              marginBottom: '1rem',
            }}>
              {stack}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            style={{
              background: '#CC0000', color: '#fff', border: 'none', borderRadius: 10,
              padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
