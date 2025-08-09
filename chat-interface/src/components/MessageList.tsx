import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import { MessageItem } from './MessageItem';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  autoScroll: boolean;
  className?: string;
}

/**
 * Component for rendering conversation history with auto-scroll functionality
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  autoScroll,
  className = ''
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && !userScrolledRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Reset user scroll flag when loading starts (new message being sent)
  useEffect(() => {
    if (isLoading) {
      userScrolledRef.current = false;
    }
  }, [isLoading]);

  // Track user scrolling to prevent auto-scroll when user is viewing older messages
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
    
    userScrolledRef.current = !isAtBottom;
  };

  return (
    <div className={`message-list ${className}`}>
      <div 
        className="messages-container"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 && !isLoading ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p className="empty-text">Start a conversation by typing a message below</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
              />
            ))}
            {isLoading && (
              <div className="loading-indicator">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="loading-text">AI is thinking...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};