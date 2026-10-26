import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            textAlign: 'center',
            padding: 24,
            fontFamily: 'sans-serif',
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16, maxWidth: 420 }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#111827',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}