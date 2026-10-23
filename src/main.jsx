import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('SurakshaHub render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: '32px', background: '#05070d', color: '#f4f8ff', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ maxWidth: 760, margin: '8vh auto', padding: 28, border: '1px solid #354763', borderRadius: 16, background: '#0b1220' }}>
            <h1 style={{ color: '#42f5e9' }}>SurakshaHub could not render</h1>
            <p>The app encountered a frontend error instead of showing a blank screen.</p>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#ffb7c4', background: '#180d17', padding: 16, borderRadius: 8 }}>{String(this.state.error?.message || this.state.error)}</pre>
            <p>Copy this error message and share it for troubleshooting. Do not include passwords or API keys.</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 16px', borderRadius: 8, border: 0, background: 'linear-gradient(105deg,#19bed8,#416eff)', color: '#030b16', fontWeight: 700, cursor: 'pointer' }}>Reload app</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));
root.render(<AppErrorBoundary><React.StrictMode><App /></React.StrictMode></AppErrorBoundary>);
