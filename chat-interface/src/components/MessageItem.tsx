import React from 'react';
import { Message, MessageStatus } from '../types';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  className?: string;
}

/**
 * Individual message component with sender distinction and status indicators
 */
export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
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
    <div className={messageClasses}>
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
        </div>
        {message.audioUrl && (
          <div className="message-audio">
            <button 
              className="audio-play-button"
              onClick={() => {
                // Audio playback will be implemented in a later task
                console.log('Audio playback not yet implemented');
              }}
              aria-label="Play audio"
            >
              🔊 Play Audio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};