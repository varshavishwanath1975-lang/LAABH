import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] text-gray-100 flex items-center justify-center p-6">
          <div className="bg-gray-900 border border-red-500/50 rounded-xl p-8 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
              <h1 className="text-xl font-bold text-red-400">Application Rendering Error</h1>
            </div>
            <p className="text-sm text-gray-300">
              LAABH encountered an unexpected rendering failure. The details have been captured below:
            </p>
            <div className="p-3 bg-gray-950 rounded border border-gray-800 text-xs font-mono text-red-300 overflow-x-auto">
              {this.state.error && this.state.error.toString()}
            </div>
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary text-xs"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn-secondary text-xs"
              >
                Try Resetting View State
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
