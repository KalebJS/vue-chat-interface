import React from 'react';
import type { AudioState, LangChainState } from '../types';
import './FallbackUI.css';

interface FallbackUIProps {
  type: 'audio' | 'langchain' | 'network' | 'general';
  error?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Fallback UI component for when features are unavailable
 * Provides user-friendly error messages and recovery options
 */
export const FallbackUI: React.FC<FallbackUIProps> = ({
  type,
  error,
  onRetry,
  onDismiss,
  className = ''
}) => {
  const getFallbackContent = () => {
    switch (type) {
      case 'audio':
        return {
          icon: '🔇',
          title: 'Audio Unavailable',
          message: 'Audio features are not available. You can continue using text-only mode.',
          details: error || 'This might be due to browser compatibility or permission issues.',
          suggestions: [
            'Make sure you\'re using a modern browser (Chrome, Edge, Safari)',
            'Grant microphone permission when prompted',
            'Ensure you\'re on a secure (HTTPS) connection'
          ]
        };

      case 'langchain':
        return {
          icon: '🤖',
          title: 'AI Model Unavailable',
          message: 'The AI model is currently unavailable.',
          details: error || 'This might be due to network issues or service maintenance.',
          suggestions: [
            'Check your internet connection',
            'Try again in a few moments',
            'Contact support if the issue persists'
          ]
        };

      case 'network':
        return {
          icon: '🌐',
          title: 'Connection Issue',
          message: 'Unable to connect to the service.',
          details: error || 'Please check your internet connection and try again.',
          suggestions: [
            'Check your internet connection',
            'Disable VPN or proxy if enabled',
            'Try refreshing the page'
          ]
        };

      default:
        return {
          icon: '⚠️',
          title: 'Service Unavailable',
          message: 'A service is temporarily unavailable.',
          details: error || 'Please try again later.',
          suggestions: [
            'Refresh the page',
            'Check your internet connection',
            'Contact support if the issue persists'
          ]
        };
    }
  };

  const content = getFallbackContent();

  return (
    <div className={`fallback-ui fallback-ui--${type} ${className}`}>
      <div className="fallback-ui__content">
        <div className="fallback-ui__icon">{content.icon}</div>
        <h3 className="fallback-ui__title">{content.title}</h3>
        <p className="fallback-ui__message">{content.message}</p>
        
        {content.details && (
          <p className="fallback-ui__details">{content.details}</p>
        )}

        {content.suggestions.length > 0 && (
          <div className="fallback-ui__suggestions">
            <h4>Suggestions:</h4>
            <ul>
              {content.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="fallback-ui__actions">
          {onRetry && (
            <button 
              className="fallback-ui__retry-button"
              onClick={onRetry}
              aria-label="Retry operation"
            >
              Try Again
            </button>
          )}
          
          {onDismiss && (
            <button 
              className="fallback-ui__dismiss-button"
              onClick={onDismiss}
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Audio-specific fallback component
 */
interface AudioFallbackProps {
  audioState: AudioState;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const AudioFallback: React.FC<AudioFallbackProps> = ({
  audioState,
  onRetry,
  onDismiss,
  className
}) => {
  if (audioState.isSupported && !audioState.error) {
    return null;
  }

  return (
    <FallbackUI
      type="audio"
      error={audioState.error}
      onRetry={onRetry}
      onDismiss={onDismiss}
      className={className}
    />
  );
};

/**
 * LangChain-specific fallback component
 */
interface LangChainFallbackProps {
  langChainState: LangChainState;
  error?: string;
  onRetry?: () => void;
  onReset?: () => void;
  className?: string;
}

export const LangChainFallback: React.FC<LangChainFallbackProps> = ({
  langChainState,
  error,
  onRetry,
  onReset,
  className
}) => {
  if (langChainState.isInitialized && !error) {
    return null;
  }

  return (
    <div className={`langchain-fallback ${className || ''}`}>
      <FallbackUI
        type="langchain"
        error={error}
        onRetry={onRetry}
        className="langchain-fallback__ui"
      />
      
      {onReset && (
        <div className="langchain-fallback__reset">
          <button 
            className="langchain-fallback__reset-button"
            onClick={onReset}
            aria-label="Reset AI model"
          >
            Reset AI Model
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Network status indicator component
 */
interface NetworkStatusProps {
  isOnline: boolean;
  className?: string;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  isOnline,
  className = ''
}) => {
  if (isOnline) {
    return null;
  }

  return (
    <div className={`network-status network-status--offline ${className}`}>
      <div className="network-status__content">
        <span className="network-status__icon">📡</span>
        <span className="network-status__message">
          You're offline. Messages will be sent when connection is restored.
        </span>
      </div>
    </div>
  );
};

/**
 * Loading fallback for when services are initializing
 */
interface LoadingFallbackProps {
  message?: string;
  className?: string;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = 'Loading...',
  className = ''
}) => {
  return (
    <div className={`loading-fallback ${className}`}>
      <div className="loading-fallback__content">
        <div className="loading-fallback__spinner">
          <div className="loading-fallback__spinner-inner"></div>
        </div>
        <p className="loading-fallback__message">{message}</p>
      </div>
    </div>
  );
};