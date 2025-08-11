import React, { useRef, type KeyboardEvent } from 'react';
import { RecordButton } from './RecordButton';
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
    <div className={`input-area ${className}`} role="region" aria-label="Message input area">
      <div className="input-container">
        <label htmlFor="message-input" className="sr-only">
          Type your message here
        </label>
        <textarea
          id="message-input"
          ref={textareaRef}
          className="message-input"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          aria-label="Message input"
          aria-describedby={isRecording ? "recording-status" : undefined}
          aria-invalid={false}
          autoComplete="off"
          spellCheck="true"
        />
        
        <div className="input-buttons" role="group" aria-label="Message actions">
          {audioEnabled && (
            <RecordButton
              isRecording={isRecording}
              isLoading={isLoading}
              audioEnabled={audioEnabled}
              onToggleRecording={onToggleRecording}
            />
          )}
          
          <button
            className={`send-button ${canSubmit ? 'enabled' : 'disabled'}`}
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label={isLoading ? "Sending message..." : "Send message"}
            title="Send message (Enter)"
            type="button"
          >
            {isLoading ? (
              <span className="loading-spinner" aria-hidden="true">⏳</span>
            ) : (
              <span aria-hidden="true">➤</span>
            )}
          </button>
        </div>
      </div>
      
      {isRecording && (
        <div 
          id="recording-status"
          className="recording-indicator" 
          role="status" 
          aria-live="polite"
          aria-label="Recording in progress"
        >
          <div className="recording-pulse" aria-hidden="true"></div>
          <span>Recording... Click stop when finished</span>
        </div>
      )}
    </div>
  );
};