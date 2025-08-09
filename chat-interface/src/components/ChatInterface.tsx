import React from 'react';
import { useStateManager } from '../hooks/useStateManager';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import './ChatInterface.css';

interface ChatInterfaceProps {
  className?: string;
}

/**
 * Main chat interface component that combines message display and input areas
 * Handles user interactions and manages UI state
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const {
    state,
    sendMessage,
    updateCurrentInput,
    updateError
  } = useStateManager();

  if (!state) {
    return (
      <div className={`chat-interface loading ${className}`}>
        <div className="loading-message">Initializing chat...</div>
      </div>
    );
  }

  const handleSubmit = async (message: string) => {
    if (!message.trim()) {
      return;
    }

    try {
      await sendMessage(message.trim());
      updateCurrentInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      updateError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const handleInputChange = (value: string) => {
    updateCurrentInput(value);
  };

  const handleToggleRecording = () => {
    // Audio recording will be implemented in a later task
    console.log('Audio recording not yet implemented');
  };

  return (
    <div className={`chat-interface ${className}`}>
      <div className="chat-header">
        <h1>AI Chat Interface</h1>
        {state.error && (
          <div className="error-banner">
            <span className="error-text">{state.error}</span>
            <button 
              className="error-dismiss"
              onClick={() => updateError(undefined)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <MessageList 
        messages={state.messages}
        isLoading={state.isLoading}
        autoScroll={state.settings.autoScroll}
      />

      <InputArea
        value={state.currentInput}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        onToggleRecording={handleToggleRecording}
        isLoading={state.isLoading}
        isRecording={state.audioState.isRecording}
        audioEnabled={state.settings.audioEnabled && state.audioState.isSupported}
        placeholder="Type your message..."
      />
    </div>
  );
};