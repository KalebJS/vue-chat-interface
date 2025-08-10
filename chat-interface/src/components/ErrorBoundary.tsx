import React, { Component, ReactNode } from 'react';
import type { AudioState, LangChainState } from '../types';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  className?: string;
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the child component tree
 * Provides fallback UI and retry functionality
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const maxRetries = this.props.maxRetries || 3;
    
    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      const maxRetries = this.props.maxRetries ?? 3;
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <div className={`error-boundary ${this.props.className || ''}`}>
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p className="error-message">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="error-actions">
              {canRetry && (
                <button 
                  className="retry-button"
                  onClick={this.handleRetry}
                  aria-label="Retry operation"
                >
                  Retry ({maxRetries - this.state.retryCount} attempts left)
                </button>
              )}
              
              <button 
                className="reset-button"
                onClick={this.handleReset}
                aria-label="Reset application"
              >
                Reset
              </button>
              
              <button 
                className="refresh-button"
                onClick={() => window.location.reload()}
                aria-label="Refresh page"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Audio-specific error boundary that provides graceful degradation for audio features
 */
interface AudioErrorBoundaryProps extends ErrorBoundaryProps {
  audioState?: AudioState;
  onAudioDisabled?: () => void;
}

export class AudioErrorBoundary extends Component<AudioErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: AudioErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Disable audio features on error
    if (this.props.onAudioDisabled) {
      this.props.onAudioDisabled();
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error('AudioErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`audio-error-boundary ${this.props.className || ''}`}>
          <div className="audio-error-content">
            <div className="audio-error-icon">🔇</div>
            <p className="audio-error-message">
              Audio features are temporarily unavailable. You can continue using text-only mode.
            </p>
            <button 
              className="audio-retry-button"
              onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
              aria-label="Retry audio features"
            >
              Try Audio Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * LangChain-specific error boundary for AI model errors
 */
interface LangChainErrorBoundaryProps extends ErrorBoundaryProps {
  langChainState?: LangChainState;
  onModelReset?: () => void;
}

export class LangChainErrorBoundary extends Component<LangChainErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: LangChainErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error('LangChainErrorBoundary caught an error:', error, errorInfo);
  }

  handleModelReset = () => {
    if (this.props.onModelReset) {
      this.props.onModelReset();
    }
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={`langchain-error-boundary ${this.props.className || ''}`}>
          <div className="langchain-error-content">
            <div className="langchain-error-icon">🤖</div>
            <h3>AI Model Error</h3>
            <p className="langchain-error-message">
              The AI model encountered an error. This might be due to network issues or model availability.
            </p>
            <div className="langchain-error-actions">
              <button 
                className="model-retry-button"
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                aria-label="Retry AI model"
              >
                Retry
              </button>
              <button 
                className="model-reset-button"
                onClick={this.handleModelReset}
                aria-label="Reset AI model"
              >
                Reset Model
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}