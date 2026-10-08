import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0A' }}>
          <div className="max-w-md w-full mx-4 p-8 rounded-2xl text-center" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle className="w-8 h-8" style={{ color: '#ef4444' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-sm mb-6" style={{ color: '#888' }}>
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error && (
              <div className="mb-6 p-3 rounded-lg text-left text-xs font-mono overflow-auto max-h-40" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', color: '#ef4444' }}>
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: '#CC0000', color: '#fff' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#a30000'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#CC0000'; }}
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
