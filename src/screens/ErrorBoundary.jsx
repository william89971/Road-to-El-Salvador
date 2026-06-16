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
    // Log to console only; no external telemetry in this build.
    console.error('Game error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.wrap}>
          <div style={styles.card}>
            <div style={styles.icon}>🛻💥</div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.body}>The road trip hit an unexpected bump. Reload to try again.</p>
            {this.state.error?.message && (
              <pre style={styles.detail}>{this.state.error.message}</pre>
            )}
            <button style={styles.btn} onClick={() => window.location.reload()}>
              RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  wrap: {
    position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
    background: 'var(--bg)', padding: 16, zIndex: 9999,
  },
  card: {
    width: 'min(440px, 92vw)', textAlign: 'center',
    background: 'rgba(20,15,12,0.95)', border: '1px solid rgba(247,147,26,0.4)',
    borderRadius: 16, padding: '28px 24px', color: 'var(--paper)',
    fontFamily: 'var(--font-num)',
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontFamily: 'var(--font-title)', fontSize: 32, marginBottom: 8, color: 'var(--danger)' },
  body: { fontSize: 15, lineHeight: 1.5, color: '#d8c7a6', marginBottom: 16 },
  detail: {
    fontSize: 12, color: '#8c8068', background: 'rgba(0,0,0,0.3)',
    padding: 10, borderRadius: 8, marginBottom: 16, overflowX: 'auto',
  },
  btn: {
    padding: '12px 24px', fontSize: 20, borderRadius: 10,
    background: 'var(--btc)', color: '#1a1411', cursor: 'pointer',
  },
};
