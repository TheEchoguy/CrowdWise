import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CROWDWISE Uncaught Runtime Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: '#0B1020',
          color: '#F1F5F9',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '640px',
            width: '100%',
            backgroundColor: '#121A2B',
            border: '1px solid #EF4444',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                padding: '8px',
                borderRadius: '8px'
              }}>
                <AlertTriangle style={{ width: '28px', height: '28px', color: '#EF4444' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#F87171' }}>
                  CROWDWISE Application Error
                </h2>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0 0' }}>
                  A component encountered an unhandled runtime exception.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#070A14',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#FCA5A5',
              overflowX: 'auto',
              marginBottom: '16px',
              maxHeight: '200px'
            }}>
              <strong>{this.state.error?.name}: </strong>
              {this.state.error?.message}
              {this.state.error?.stack && (
                <pre style={{ marginTop: '8px', color: '#64748B', whiteSpace: 'pre-wrap' }}>
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#06B6D4',
                  color: '#0B1020',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw style={{ width: '14px', height: '14px' }} />
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#23324D',
                  color: '#E2E8F0',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw style={{ width: '14px', height: '14px' }} />
                Clear Cache &amp; Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

