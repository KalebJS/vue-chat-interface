import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { Message, AudioState, VoiceSettings } from '../types';
import { MessageItem } from './MessageItem';
import './MessageList.css';

interface VirtualizedMessageListProps {
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
  onScrollToTop?: () => void;
  // Virtualization settings
  itemHeight?: number; // Average height of a message item
  overscan?: number; // Number of items to render outside visible area
  threshold?: number; // Number of messages before virtualization kicks in
}

/**
 * Virtualized message list component for handling large conversation histories
 * Only renders visible messages to improve performance
 */
export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
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
  onScrollToTop,
  itemHeight = 80, // Default estimated height per message
  overscan = 5, // Render 5 extra items above/below visible area
  threshold = 100 // Start virtualizing after 100 messages
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const lastMessageCountRef = useRef(messages.length);
  
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearTop, setIsNearTop] = useState(false);

  // Determine if we should use virtualization
  const shouldVirtualize = messages.length > threshold;

  // Calculate visible range for virtualization
  const visibleRange = useMemo(() => {
    if (!shouldVirtualize || containerHeight === 0) {
      return { start: 0, end: messages.length };
    }

    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      messages.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );

    // Add overscan
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(messages.length, visibleEnd + overscan);

    return { start, end };
  }, [shouldVirtualize, containerHeight, scrollTop, itemHeight, overscan, messages.length]);

  // Get visible messages
  const visibleMessages = useMemo(() => {
    if (!shouldVirtualize) {
      return messages.map((message, index) => ({ message, index }));
    }

    return messages
      .slice(visibleRange.start, visibleRange.end)
      .map((message, relativeIndex) => ({
        message,
        index: visibleRange.start + relativeIndex
      }));
  }, [messages, visibleRange, shouldVirtualize]);

  // Calculate total height for virtualization
  const totalHeight = shouldVirtualize ? messages.length * itemHeight : 'auto';

  // Calculate offset for visible items
  const offsetY = shouldVirtualize ? visibleRange.start * itemHeight : 0;

  // Update container height when component mounts or resizes
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const messageCountIncreased = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (autoScroll && !userScrolledRef.current && messagesEndRef.current && messageCountIncreased) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Reset user scroll flag when loading starts
  useEffect(() => {
    if (isLoading) {
      userScrolledRef.current = false;
    }
  }, [isLoading]);

  // Enhanced scroll handler
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop: newScrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = newScrollTop + clientHeight >= scrollHeight - 20;
    const isAtTop = newScrollTop <= 50;
    
    // Update scroll position for virtualization
    setScrollTop(newScrollTop);
    
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
      if (document.activeElement !== containerRef.current) return;

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
          containerRef.current.scrollBy({ 
            top: -containerRef.current.clientHeight * 0.8, 
            behavior: 'smooth' 
          });
          break;
        case 'PageDown':
          event.preventDefault();
          containerRef.current.scrollBy({ 
            top: containerRef.current.clientHeight * 0.8, 
            behavior: 'smooth' 
          });
          break;
        case 'ArrowUp':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            containerRef.current.scrollBy({ top: -50, behavior: 'smooth' });
          }
          break;
        case 'ArrowDown':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            containerRef.current.scrollBy({ top: 50, behavior: 'smooth' });
          }
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
    <div className={`message-list ${shouldVirtualize ? 'virtualized' : ''} ${className}`}>
      <div 
        className="messages-container"
        ref={containerRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-label="Conversation history"
        aria-describedby="keyboard-navigation-help"
        style={{
          height: shouldVirtualize ? '100%' : 'auto',
          overflowY: shouldVirtualize ? 'auto' : 'visible'
        }}
      >
        {/* Virtual scrolling container */}
        <div
          style={{
            height: totalHeight,
            position: 'relative'
          }}
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
              {/* Visible messages container */}
              <div
                style={{
                  transform: `translateY(${offsetY}px)`,
                  position: shouldVirtualize ? 'absolute' : 'static',
                  top: 0,
                  left: 0,
                  right: 0
                }}
              >
                {visibleMessages.map(({ message, index }) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    audioState={audioState}
                    voiceSettings={voiceSettings}
                    onPlayAudio={onPlayAudio}
                    onPauseAudio={onPauseAudio}
                    onResumeAudio={onResumeAudio}
                    onStopAudio={onStopAudio}
                    style={shouldVirtualize ? {
                      height: itemHeight,
                      minHeight: itemHeight
                    } : undefined}
                  />
                ))}
              </div>

              {/* Loading indicator */}
              {isLoading && (
                <div 
                  className="loading-indicator"
                  style={{
                    position: shouldVirtualize ? 'absolute' : 'static',
                    bottom: shouldVirtualize ? 0 : 'auto',
                    transform: shouldVirtualize ? `translateY(${messages.length * itemHeight}px)` : 'none'
                  }}
                >
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
          
          {/* Scroll anchor for auto-scroll */}
          <div 
            ref={messagesEndRef} 
            style={{
              position: shouldVirtualize ? 'absolute' : 'static',
              bottom: 0,
              height: 1
            }}
          />
        </div>
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

      {/* Performance info for debugging */}
      {shouldVirtualize && process.env.NODE_ENV === 'development' && (
        <div className="virtualization-debug">
          <small>
            Virtualized: {visibleRange.start}-{visibleRange.end} of {messages.length} messages
          </small>
        </div>
      )}

      {/* Navigation hint for keyboard users */}
      <div className="sr-only" aria-live="polite" id="keyboard-navigation-help">
        Keyboard navigation: Focus the message area and use Ctrl+Home to scroll to top, 
        Ctrl+End to scroll to bottom, Page Up/Down to navigate, Ctrl+Arrow keys for fine scrolling
      </div>
    </div>
  );
};