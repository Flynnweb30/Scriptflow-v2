import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error: error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    background: '#0d1527',
                    borderRadius: '16px',
                    border: '1px solid #ef4444',
                    maxWidth: '600px',
                    margin: '40px auto'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                    <h2 style={{ color: '#ef4444', marginBottom: '8px', fontSize: '20px' }}>Something went wrong</h2>
                    <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '14px' }}>
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '10px',
                                border: 'none',
                                background: '#2563eb',
                                color: '#fff',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            className="hover:opacity-90"
                        >
                            <i className="fas fa-sync" style={{ marginRight: '8px' }}></i>
                            Reload Page
                        </button>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '10px',
                                border: '1px solid #1e293b',
                                background: 'transparent',
                                color: '#94a3b8',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            className="hover:bg-slate-800"
                        >
                            <i className="fas fa-arrow-left" style={{ marginRight: '8px' }}></i>
                            Go Back
                        </button>
                    </div>
                    {this.state.errorInfo && (
                        <details style={{
                            marginTop: '20px',
                            padding: '12px',
                            background: '#090e1a',
                            borderRadius: '8px',
                            textAlign: 'left',
                            fontSize: '12px',
                            color: '#94a3b8',
                            maxHeight: '200px',
                            overflow: 'auto'
                        }}>
                            <summary style={{ fontWeight: 700, cursor: 'pointer', color: '#64748b' }}>
                                <i className="fas fa-code" style={{ marginRight: '8px' }}></i>
                                Error Details
                            </summary>
                            <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;