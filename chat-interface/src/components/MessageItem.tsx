import React from 'react';
import type { Message, AudioState, VoiceSettings } from '../types';
import { MessageStatus } from '../types';
import { AudioControls } from './AudioControls';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  audioState: AudioState;
  voiceSettings?: VoiceSettings;
  onPlayAudio: (text: string, settings?: VoiceSettings) => void;
  onPauseAudio: () => void;
  onResumeAudio: () => void;
  onStopAudio: () => void;
  className?: string;
}

/**
 * Individual message component with sender distinction and status indicators
 */
export const MessageItem: React.FC<MessageItemProps> = ({ 
  message,
  audioState,
  voiceSettings,
  onPlayAudio,
  onPauseAudio,
  onResumeAudio,
  onStopAudio,
  className = '' 
}) => {
  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusIcon = (status: MessageStatus) => {
    switch (status) {
      case MessageStatus.SENDING:
        return '⏳';
      case MessageStatus.SENT:
        return '✓';
      case MessageStatus.ERROR:
        return '❌';
      default:
        return '';
    }
  };

  const messageClasses = [
    'message-item',
    `message-${message.sender}`,
    `status-${message.status}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={messageClasses}
      data-streaming={message.isStreaming || false}
    >
      <div className="message-content">
        <div className="message-header">
          <span className="message-sender">
            {message.sender === 'user' ? 'You' : 'AI'}
          </span>
          <span className="message-time">
            {formatTime(message.timestamp)}
          </span>
          <span className="message-status" aria-label={`Message ${message.status}`}>
            {getStatusIcon(message.status)}
          </span>
        </div>
        <div className="message-text">
          {message.text}
          {message.isStreaming && (
            <span className="streaming-indicator" aria-label="AI is typing">
              <span className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </span>
          )}
        </div>
        {/* Show audio controls for AI messages or if audioUrl exists */}
        {(message.sender === 'ai' || message.audioUrl) && (
          <div className="message-audio">
            <AudioControls
              text={message.text}
              audioState={audioState}
              voiceSettings={voiceSettings}
              onPlay={onPlayAudio}
              onPause={onPauseAudio}
              onResume={onResumeAudio}
              onStop={onStopAudio}
              messageId={message.id}
            />
          </div>
        )}
      </div>
    </div>
  );
};