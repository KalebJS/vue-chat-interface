import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useStateManager } from '../hooks/useStateManager';
import { VirtualizedMessageList } from './VirtualizedMessageList';
import { InputArea } from './InputArea';
import { LazyAudioController } from '../services/LazyAudioController';
import { ErrorBoundary, AudioErrorBoundary, LangChainErrorBoundary } from './ErrorBoundary';
import { AudioFallback, LangChainFallback, NetworkStatus, LoadingFallback } from './FallbackUI';
import { NetworkErrorHandler } from '../services/NetworkErrorHandler';
import { performanceMonitor, useMeasureRender } from '../utils/performance';
import './ChatInterface.css';
import './ErrorBoundary.css';
import './FallbackUI.css';

// Lazy load heavy components
const SettingsPanel = lazy(() => import('./SettingsPanel').then(module => ({ default: module.SettingsPanel })));
const SettingsButton = lazy(() => import('./SettingsButton').then(module => ({ default: module.SettingsButton })));

interface ChatInterfaceProps {
  className?: string;
}

/**
 * Main chat interface component that combines message display and input areas
 * Handles user interactions and manages UI state
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  // Measure render performance
  useMeasureRender('ChatInterface');

  const {
    state,
    sendMessage,
    updateCurrentInput,
    updateError,
    updateAudioState,
    updateSettings,
    initializeLangChain,
    getAvailableVoices,
    updateModelConfig
  } = useStateManager();
  
  const audioControllerRef = useRef<LazyAudioController | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [audioDisabled, setAudioDisabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Setup network monitoring
  useEffect(() => {
    const cleanup = NetworkErrorHandler.setupConnectionMonitoring(
      () => setIsOnline(true),
      () => setIsOnline(false)
    );

    return cleanup;
  }, []);

  // Initialize LangChain service and AudioController on component mount
  useEffect(() => {
    const initialize = async () => {
      if (state && !state.langChainState.isInitialized) {
        try {
          await initializeLangChain();
          // Load conversation history after initialization
          // This will be handled by the state manager
        } catch (error) {
          console.error('Failed to initialize LangChain:', error);
          // Error is already handled in initializeLangChain
        }
      }
    };

    initialize();
  }, [state?.langChainState.isInitialized, initializeLangChain]);

  // Initialize LazyAudioController
  useEffect(() => {
    if (!audioControllerRef.current && !audioDisabled) {
      try {
        audioControllerRef.current = new LazyAudioController();
        
        // Set up audio state callback
        audioControllerRef.current.setStateChangeCallback((audioState) => {
          updateAudioState(audioState);
        });
        
        // Set up transcription callback to update input
        audioControllerRef.current.setTranscriptionCallback((text) => {
          updateCurrentInput(text);
        });
        
        // Initialize audio state (basic state without full initialization)
        updateAudioState(audioControllerRef.current.getBasicState());
      } catch (error) {
        console.error('Failed to initialize AudioController:', error);
        setAudioDisabled(true);
        if (updateError) {
          updateError('Audio features are not available');
        }
      }
    }

    return () => {
      if (audioControllerRef.current) {
        audioControllerRef.current.destroy();
        audioControllerRef.current = null;
      }
    };
  }, [updateAudioState, updateCurrentInput, audioDisabled]);

  // Load available voices for settings
  useEffect(() => {
    const loadVoices = () => {
      const voices = getAvailableVoices();
      setAvailableVoices(voices);
    };

    // Load voices immediately
    loadVoices();

    // Also load when voices change (some browsers load them asynchronously)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, [getAvailableVoices]);

  if (!state) {
    return (
      <LoadingFallback 
        message="Initializing chat..." 
        className={`chat-interface loading ${className}`}
      />
    );
  }

  // Show initialization loading state
  if (!state.langChainState.isInitialized && state.isLoading) {
    return (
      <LoadingFallback 
        message="Initializing AI model..." 
        className={`chat-interface loading ${className}`}
      />
    );
  }

  const handleSubmit = async (message: string) => {
    if (!message.trim()) {
      return;
    }

    // Check if LangChain is initialized
    if (!state.langChainState.isInitialized) {
      updateError('AI model not initialized. Please wait or refresh the page.');
      return;
    }

    // Clear input immediately to prevent duplicate submissions
    updateCurrentInput('');

    try {
      await sendMessage(message.trim());
    } catch (error) {
      console.error('Failed to send message:', error);
      updateError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const handleInputChange = (value: string) => {
    updateCurrentInput(value);
  };

  const handleToggleRecording = async () => {
    if (!audioControllerRef.current) {
      updateError('Audio controller not initialized');
      return;
    }

    try {
      if (state?.audioState.isRecording) {
        // Stop recording
        audioControllerRef.current.stopRecording();
      } else {
        // Start recording
        await audioControllerRef.current.startRecording();
      }
    } catch (error) {
      console.error('Audio recording error:', error);
      updateError(error instanceof Error ? error.message : 'Audio recording failed');
    }
  };

  const handlePlayAudio = async (text: string, voiceSettings?: any) => {
    if (!audioControllerRef.current) {
      updateError('Audio controller not initialized');
      return;
    }

    try {
      await audioControllerRef.current.speakText(text, voiceSettings);
    } catch (error) {
      console.error('Audio playback error:', error);
      updateError(error instanceof Error ? error.message : 'Audio playback failed');
    }
  };

  const handlePauseAudio = () => {
    if (!audioControllerRef.current) {
      return;
    }

    try {
      audioControllerRef.current.pauseSpeaking();
    } catch (error) {
      console.error('Audio pause error:', error);
      updateError(error instanceof Error ? error.message : 'Failed to pause audio');
    }
  };

  const handleResumeAudio = () => {
    if (!audioControllerRef.current) {
      return;
    }

    try {
      audioControllerRef.current.resumeSpeaking();
    } catch (error) {
      console.error('Audio resume error:', error);
      updateError(error instanceof Error ? error.message : 'Failed to resume audio');
    }
  };

  const handleStopAudio = () => {
    if (!audioControllerRef.current) {
      return;
    }

    try {
      audioControllerRef.current.stopSpeaking();
    } catch (error) {
      console.error('Audio stop error:', error);
      updateError(error instanceof Error ? error.message : 'Failed to stop audio');
    }
  };

  const handleScrollToTop = () => {
    // Handle loading more history when user scrolls to top
    // This could trigger loading older messages in a real implementation
    console.log('Loading more history...');
  };

  const handleAudioError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Audio error boundary caught error:', error, errorInfo);
    setAudioDisabled(true);
    updateError('Audio features have been disabled due to an error');
  };

  const handleLangChainError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('LangChain error boundary caught error:', error, errorInfo);
    updateError('AI model encountered an error');
  };

  const handleRetryAudio = async () => {
    if (audioControllerRef.current) {
      try {
        const recovered = await audioControllerRef.current.recoverFromError();
        if (recovered) {
          setAudioDisabled(false);
          updateError(undefined);
        }
      } catch (error) {
        console.error('Failed to recover audio:', error);
      }
    }
  };

  const handleRetryLangChain = async () => {
    try {
      await initializeLangChain();
      updateError(undefined);
    } catch (error) {
      console.error('Failed to retry LangChain initialization:', error);
    }
  };

  const handleResetLangChain = () => {
    // This would reset the LangChain service
    // Implementation depends on state manager capabilities
    updateError(undefined);
    console.log('Resetting LangChain service...');
  };

  const handleDismissError = () => {
    updateError(undefined);
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleSettingsChange = async (newSettings: Partial<any>) => {
    try {
      // Update settings in state manager
      updateSettings(newSettings);

      // If AI model configuration changed, update LangChain service
      if (newSettings.aiModel?.model && state?.langChainState.isInitialized) {
        await updateModelConfig(newSettings.aiModel.model);
      }

      // Close settings panel
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Failed to update settings:', error);
      updateError(error instanceof Error ? error.message : 'Failed to update settings');
    }
  };

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Main error boundary caught error:', error, errorInfo);
        updateError('An unexpected error occurred');
      }}
      className={className}
    >
      <div 
        className={`chat-interface ${className}`}
        role="main"
        aria-label="AI Chat Interface"
      >
        <NetworkStatus isOnline={isOnline} />
        
        <header className="chat-header" role="banner">
          <div className="chat-title">
            <h1 id="chat-title">AI Chat Interface</h1>
          </div>
          <div className="chat-controls" role="toolbar" aria-label="Chat controls">
            <Suspense fallback={<div className="settings-loading">⚙️</div>}>
              <SettingsButton 
                onClick={handleOpenSettings}
                disabled={!state}
              />
            </Suspense>
          </div>
          {state.error && (
            <div 
              className="error-banner" 
              role="alert" 
              aria-live="assertive"
              aria-describedby="error-text"
            >
              <span id="error-text" className="error-text">{state.error}</span>
              <button 
                className="error-dismiss"
                onClick={handleDismissError}
                aria-label="Dismiss error message"
                title="Close error message"
              >
                ×
              </button>
            </div>
          )}
        </header>

        {/* LangChain Error Handling */}
        <LangChainErrorBoundary
          langChainState={state.langChainState}
          onError={handleLangChainError}
          onModelReset={handleResetLangChain}
        >
          <LangChainFallback
            langChainState={state.langChainState}
            error={!state.langChainState.isInitialized ? state.error : undefined}
            onRetry={handleRetryLangChain}
            onReset={handleResetLangChain}
          />
        </LangChainErrorBoundary>

        {/* Audio Error Handling */}
        <AudioErrorBoundary
          audioState={state.audioState}
          onError={handleAudioError}
          onAudioDisabled={() => setAudioDisabled(true)}
        >
          <AudioFallback
            audioState={state.audioState}
            onRetry={handleRetryAudio}
            onDismiss={() => setAudioDisabled(true)}
          />
        </AudioErrorBoundary>

        <ErrorBoundary
          fallback={
            <div className="message-list-error" role="alert">
              <p>Unable to display messages. Please refresh the page.</p>
            </div>
          }
        >
          <VirtualizedMessageList 
            messages={state.messages}
            isLoading={state.isLoading}
            autoScroll={state.settings.autoScroll}
            audioState={state.audioState}
            voiceSettings={state.settings.voiceSettings}
            onPlayAudio={handlePlayAudio}
            onPauseAudio={handlePauseAudio}
            onResumeAudio={handleResumeAudio}
            onStopAudio={handleStopAudio}
            onScrollToTop={handleScrollToTop}
            threshold={50} // Start virtualizing after 50 messages
            itemHeight={100} // Estimated height per message
            overscan={3} // Render 3 extra items above/below
          />
        </ErrorBoundary>

        <ErrorBoundary
          fallback={
            <div className="input-area-error" role="alert">
              <p>Input area is temporarily unavailable. Please refresh the page.</p>
            </div>
          }
        >
          <InputArea
            value={state.currentInput}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            onToggleRecording={handleToggleRecording}
            isLoading={state.isLoading}
            isRecording={state.audioState.isRecording}
            audioEnabled={state.settings.audioEnabled && state.audioState.isSupported && !audioDisabled}
            placeholder="Type your message..."
          />
        </ErrorBoundary>

        {/* Settings Panel */}
        {state && isSettingsOpen && (
          <Suspense fallback={
            <div className="settings-panel-loading">
              <div className="loading-spinner">⚙️</div>
              <span>Loading settings...</span>
            </div>
          }>
            <SettingsPanel
              settings={state.settings}
              onSettingsChange={handleSettingsChange}
              onClose={handleCloseSettings}
              isOpen={isSettingsOpen}
              availableVoices={availableVoices}
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
};