import React from 'react';
import { useStateManager, useMessages, useAudioState, useLangChainState } from '../hooks/useStateManager';
import { MessageStatus } from '../types';

/**
 * Example component demonstrating StateManager integration with React
 * This shows how to use the state management system in a React component
 */
export function StateManagerExample() {
  const {
    state,
    addMessage,
    updateCurrentInput,
    updateAudioState,
    updateSettings,
    clearMessages,
    initializeLangChain,
    sendMessage,
    getDebugInfo
  } = useStateManager();

  // Alternative: Use specialized hooks for specific state slices
  const messages = useMessages();
  const audioState = useAudioState();
  const langChainState = useLangChainState();

  const handleAddMessage = () => {
    addMessage({
      text: `Test message ${Date.now()}`,
      sender: 'user',
      status: MessageStatus.SENT
    });
  };

  const handleSendAIMessage = async () => {
    try {
      await sendMessage('Hello, how are you?');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleInitializeLangChain = async () => {
    try {
      await initializeLangChain();
    } catch (error) {
      console.error('Failed to initialize LangChain:', error);
    }
  };

  const handleToggleAudio = () => {
    updateAudioState({ 
      isRecording: !audioState.isRecording 
    });
  };

  const handleUpdateSettings = () => {
    updateSettings({
      autoScroll: !state?.settings.autoScroll
    });
  };

  if (!state) {
    return <div>Loading state...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>StateManager Example</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Current State</h3>
        <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          <p><strong>Messages:</strong> {messages.length}</p>
          <p><strong>Current Input:</strong> "{state.currentInput}"</p>
          <p><strong>Loading:</strong> {state.isLoading ? 'Yes' : 'No'}</p>
          <p><strong>Audio Recording:</strong> {audioState.isRecording ? 'Yes' : 'No'}</p>
          <p><strong>LangChain Initialized:</strong> {langChainState.isInitialized ? 'Yes' : 'No'}</p>
          <p><strong>Auto Scroll:</strong> {state.settings.autoScroll ? 'Enabled' : 'Disabled'}</p>
          {state.error && <p style={{ color: 'red' }}><strong>Error:</strong> {state.error}</p>}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Actions</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleAddMessage}>
            Add Test Message
          </button>
          <button onClick={handleSendAIMessage}>
            Send AI Message
          </button>
          <button onClick={handleInitializeLangChain}>
            Initialize LangChain
          </button>
          <button onClick={handleToggleAudio}>
            Toggle Audio Recording
          </button>
          <button onClick={handleUpdateSettings}>
            Toggle Auto Scroll
          </button>
          <button onClick={clearMessages}>
            Clear Messages
          </button>
          <button onClick={() => updateCurrentInput('Test input')}>
            Set Test Input
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Messages</h3>
        <div style={{ 
          background: '#f9f9f9', 
          padding: '10px', 
          borderRadius: '4px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {messages.length === 0 ? (
            <p style={{ color: '#666' }}>No messages yet</p>
          ) : (
            messages.map((message) => (
              <div 
                key={message.id} 
                style={{ 
                  marginBottom: '8px',
                  padding: '8px',
                  background: message.sender === 'user' ? '#e3f2fd' : '#f3e5f5',
                  borderRadius: '4px'
                }}
              >
                <strong>{message.sender}:</strong> {message.text}
                <br />
                <small style={{ color: '#666' }}>
                  {message.timestamp.toLocaleTimeString()} - {message.status}
                </small>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3>Debug Info</h3>
        <details>
          <summary>Click to view debug information</summary>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto'
          }}>
            {JSON.stringify(getDebugInfo(), null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}