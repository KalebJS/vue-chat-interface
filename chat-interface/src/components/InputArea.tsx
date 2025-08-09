import React, { useState, useRef, KeyboardEvent } from 'react';
import './InputArea.css';

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  onToggleRecording: () => void;
  isLoading: boolean;
  isRecording: boolean;
  audioEnabled: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Input area component with text input, send button, and audio recording button
 */
export const InputArea: React.FC<InputAreaProps> = ({
  value,
  onChange,
  onSubmit,
  onToggleRecording,
  isLoading,
  isRecording,
  audioEnabled,
  placeholder = 'Type your message...',
  className = ''
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue && !isLoading) {
      onSubmit(trimmedValue);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const canSubmit = value.trim().length > 0 && !isLoading;

  return (
    <div className={`input-area ${className}`}>
      <div className="input-container">
        <textarea
          ref={textareaRef}
          className="message-input"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          aria-label="Message input"
        />
        
        <div className="input-buttons">
          {audioEnabled && (
            <button
              className={`record-button ${isRecording ? 'recording' : ''}`}
              onClick={onToggleRecording}
              disabled={isLoading}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              title={isRecording ? 'Stop recording' : 'Start voice recording'}
            >
              {isRecording ? '⏹️' : '🎤'}
            </button>
          )}
          
          <button
            className={`send-button ${canSubmit ? 'enabled' : 'disabled'}`}
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Send message"
            title="Send message (Enter)"
          >
            {isLoading ? (
              <span className="loading-spinner">⏳</span>
            ) : (
              '➤'
            )}
          </button>
        </div>
      </div>
      
      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-pulse"></div>
          <span>Recording... Click stop when finished</span>
        </div>
      )}
    </div>
  );
};