import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { Message, AudioState, VoiceSettings } from '../types';
import { MessageItem } from './MessageItem';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  autoScroll: boolean;
  audioState: AudioState;
  voiceSettings?: VoiceSettings;
  onPlayAudio: (text: string, settings?: VoiceSettings) => void;
  onPauseAudio: () => void;
  onResumeAudio: () => void;
  onStopAudio: () => void;
  className?: string;
  onScrollToTop?: () => void; // Callback for loading more history
}

/**
 * Component for rendering conversation history with auto-scroll functionality
 * and smooth scrolling navigation for long conversations
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  autoScroll,
  audioState,
  voiceSettings,
  onPlayAudio,
  onPauseAudio,
  onResumeAudio,
  onStopAudio,
  className = '',
  onScrollToTop
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const lastMessageCountRef = useRef(messages.length);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearTop, setIsNearTop] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const messageCountIncreased = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (autoScroll && !userScrolledRef.current && messagesEndRef.current && messageCountIncreased) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Reset user scroll flag when loading starts (new message being sent)
  useEffect(() => {
    if (isLoading) {
      userScrolledRef.current = false;
    }
  }, [isLoading]);

  // Enhanced scroll handler with smooth navigation features
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20; // 20px threshold
    const isAtTop = scrollTop <= 50; // 50px threshold for loading more history
    
    // Update user scroll state
    userScrolledRef.current = !isAtBottom;
    
    // Show/hide scroll to bottom button
    setShowScrollToBottom(!isAtBottom && messages.length > 5);
    
    // Check if near top for loading more history
    setIsNearTop(isAtTop);
    
    // Trigger history loading when near top
    if (isAtTop && onScrollToTop && messages.length > 0) {
      onScrollToTop();
    }
  }, [messages.length, onScrollToTop]);

  // Smooth scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      userScrolledRef.current = false;
    }
  }, []);

  // Smooth scroll to top function
  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current) return;

      switch (event.key) {
        case 'Home':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            scrollToTop();
          }
          break;
        case 'End':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            scrollToBottom();
          }
          break;
        case 'PageUp':
          event.preventDefault();
          containerRef.current.scrollBy({ top: -containerRef.current.clientHeight * 0.8, behavior: 'smooth' });
          break;
        case 'PageDown':
          event.preventDefault();
          containerRef.current.scrollBy({ top: containerRef.current.clientHeight * 0.8, behavior: 'smooth' });
          break;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [scrollToTop, scrollToBottom]);

  return (
    <div className={`message-list ${className}`}>
      <div 
        className="messages-container"
        ref={containerRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-label="Conversation history"
      >
        {/* Loading indicator for history at top */}
        {isNearTop && messages.length > 0 && (
          <div className="history-loading-indicator">
            <div className="loading-spinner">⏳</div>
            <span className="loading-text">Loading conversation history...</span>
          </div>
        )}

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
                audioState={audioState}
                voiceSettings={voiceSettings}
                onPlayAudio={onPlayAudio}
                onPauseAudio={onPauseAudio}
                onResumeAudio={onResumeAudio}
                onStopAudio={onStopAudio}
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

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom of conversation"
          title="Scroll to bottom"
        >
          <span className="scroll-icon">↓</span>
          <span className="scroll-text">New messages</span>
        </button>
      )}

      {/* Navigation hint for keyboard users */}
      <div className="sr-only" aria-live="polite">
        Use Ctrl+Home to scroll to top, Ctrl+End to scroll to bottom, Page Up/Down to navigate
      </div>
    </div>
  );
};