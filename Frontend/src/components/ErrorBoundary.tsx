import { Component } from 'react';
import type { ReactNode } from 'react';
import { RefreshCw, Home } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
            Something went wrong
          </h1>
          <p className="text-[var(--text-secondary)] mb-2">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mb-8 opacity-60">
            If this persists, please refresh the page or contact support.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--glass)] text-sm font-medium hover:opacity-80 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-xl btn-primary text-sm font-medium"
            >
              <Home className="w-4 h-4" /> Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

// Made with Bob
