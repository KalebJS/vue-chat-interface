import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageList } from '../components/MessageList';
import type { Message, AudioState, VoiceSettings } from '../types';
import { MessageStatus } from '../types';

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();
const mockScrollTo = vi.fn();
const mockScrollBy = vi.fn();

// Mock HTMLElement methods
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: mockScrollIntoView,
});

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: mockScrollTo,
});

Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
  configurable: true,
  value: mockScrollBy,
});

describe('MessageList', () => {
  const mockMessages: Message[] = [
    {
      id: '1',
      text: 'Hello, how are you?',
      sender: 'user',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      status: MessageStatus.SENT
    },
    {
      id: '2',
      text: 'I am doing well, thank you for asking!',
      sender: 'ai',
      timestamp: new Date('2023-01-01T10:01:00Z'),
      status: MessageStatus.SENT
    }
  ];

  const mockAudioState: AudioState = {
    isRecording: false,
    isPlaying: false,
    isPaused: false,
    isSupported: true,
    hasPermission: true,
    error: undefined
  };

  const mockVoiceSettings: VoiceSettings = {
    rate: 1,
    pitch: 1,
    voice: 'Test Voice'
  };

  const mockAudioHandlers = {
    onPlayAudio: vi.fn(),
    onPauseAudio: vi.fn(),
    onResumeAudio: vi.fn(),
    onStopAudio: vi.fn()
  };

  const mockOnScrollToTop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockScrollIntoView.mockClear();
    mockScrollTo.mockClear();
    mockScrollBy.mockClear();
    mockOnScrollToTop.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no messages', () => {
    render(
      <MessageList 
        messages={[]} 
        isLoading={false} 
        autoScroll={true}
        audioState={mockAudioState}
        voiceSettings={mockVoiceSettings}
        {...mockAudioHandlers}
        onScrollToTop={mockOnScrollToTop}
      />
    );

    expect(screen.getByText('💬')).toBeInTheDocument();
    expect(screen.getByText('Start a conversation by typing a message below')).toBeInTheDocument();
  });

  it('renders messages when provided', () => {
    render(
      <MessageList 
        messages={mockMessages} 
        isLoading={false} 
        autoScroll={true}
        audioState={mockAudioState}
        voiceSettings={mockVoiceSettings}
        {...mockAudioHandlers}
        onScrollToTop={mockOnScrollToTop}
      />
    );

    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByText('I am doing well, thank you for asking!')).toBeInTheDocument();
  });

  it('renders loading indicator when loading', () => {
    render(
      <MessageList 
        messages={mockMessages} 
        isLoading={true} 
        autoScroll={true}
        audioState={mockAudioState}
        voiceSettings={mockVoiceSettings}
        {...mockAudioHandlers}
        onScrollToTop={mockOnScrollToTop}
      />
    );

    expect(screen.getByText('AI is thinking...')).toBeInTheDocument();
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MessageList 
        messages={[]} 
        isLoading={false} 
        autoScroll={true} 
        audioState={mockAudioState}
        voiceSettings={mockVoiceSettings}
        {...mockAudioHandlers}
        className="custom-class"
        onScrollToTop={mockOnScrollToTop}
      />
    );

    expect(container.firstChild).toHaveClass('message-list', 'custom-class');
  });

  it('renders typing dots animation when loading', () => {
    render(
      <MessageList 
        messages={[]} 
        isLoading={true} 
        autoScroll={true}
        onScrollToTop={mockOnScrollToTop}
      />
    );

    expect(screen.getByText('AI is thinking...')).toBeInTheDocument();
    const typingDots = document.querySelector('.typing-dots');
    expect(typingDots).toBeInTheDocument();
    expect(typingDots?.children).toHaveLength(3);
  });

  it('renders messages in correct order', () => {
    render(
      <MessageList 
        messages={mockMessages} 
        isLoading={false} 
        autoScroll={true}
        onScrollToTop={mockOnScrollToTop}
      />
    );

    const messageElements = screen.getAllByText(/Hello|doing well/);
    expect(messageElements).toHaveLength(2);
    
    // First message should appear before second message in DOM
    const firstMessage = screen.getByText('Hello, how are you?');
    const secondMessage = screen.getByText('I am doing well, thank you for asking!');
    
    expect(firstMessage.compareDocumentPosition(secondMessage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows loading indicator only when loading is true', () => {
    const { rerender } = render(
      <MessageList 
        messages={mockMessages} 
        isLoading={false} 
        autoScroll={true}
        onScrollToTop={mockOnScrollToTop}
      />
    );

    expect(screen.queryByText('AI is thinking...')).not.toBeInTheDocument();

    rerender(
      <MessageList 
        messages={mockMessages} 
        isLoading={true} 
        autoScroll={true}
        onScrollToTop={mockOnScrollToTop}
      />
    );

    expect(screen.getByText('AI is thinking...')).toBeInTheDocument();
  });

  it('handles empty messages array gracefully', () => {
    render(
      <MessageList 
        messages={[]} 
        isLoading={false} 
        autoScroll={false}
        onScrollToTop={mockOnScrollToTop}
      />
    );

    expect(screen.getByText('Start a conversation by typing a message below')).toBeInTheDocument();
    expect(screen.queryByText('AI is thinking...')).not.toBeInTheDocument();
  });

  describe('Auto-scroll behavior', () => {
    it('auto-scrolls to bottom when new messages arrive and autoScroll is enabled', async () => {
      const { rerender } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      // Add a new message
      const newMessages = [...mockMessages, {
        id: '3',
        text: 'New message',
        sender: 'user' as const,
        timestamp: new Date(),
        status: MessageStatus.SENT
      }];

      rerender(
        <MessageList 
          messages={newMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      await waitFor(() => {
        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
      });
    });

    it('does not auto-scroll when autoScroll is disabled', async () => {
      const { rerender } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={false}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const newMessages = [...mockMessages, {
        id: '3',
        text: 'New message',
        sender: 'user' as const,
        timestamp: new Date(),
        status: MessageStatus.SENT
      }];

      rerender(
        <MessageList 
          messages={newMessages} 
          isLoading={false} 
          autoScroll={false}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      // Wait a bit to ensure no scroll happens
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });

    it('shows scroll to bottom button when user scrolls up', async () => {
      const { container } = render(
        <MessageList 
          messages={Array.from({ length: 10 }, (_, i) => ({
            id: `msg-${i}`,
            text: `Message ${i}`,
            sender: i % 2 === 0 ? 'user' as const : 'ai' as const,
            timestamp: new Date(),
            status: MessageStatus.SENT
          }))}
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      expect(messagesContainer).toBeInTheDocument();

      // Mock scroll properties to simulate user scrolling up
      Object.defineProperty(messagesContainer, 'scrollTop', { value: 100, configurable: true });
      Object.defineProperty(messagesContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(messagesContainer, 'clientHeight', { value: 400, configurable: true });

      if (messagesContainer) {
        fireEvent.scroll(messagesContainer);
      }

      await waitFor(() => {
        expect(screen.getByText('New messages')).toBeInTheDocument();
      });
    });

    it('hides scroll to bottom button when at bottom', async () => {
      const { container } = render(
        <MessageList 
          messages={Array.from({ length: 10 }, (_, i) => ({
            id: `msg-${i}`,
            text: `Message ${i}`,
            sender: i % 2 === 0 ? 'user' as const : 'ai' as const,
            timestamp: new Date(),
            status: MessageStatus.SENT
          }))}
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      
      // Mock scroll properties to simulate being at bottom
      Object.defineProperty(messagesContainer, 'scrollTop', { value: 600, configurable: true });
      Object.defineProperty(messagesContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(messagesContainer, 'clientHeight', { value: 400, configurable: true });

      if (messagesContainer) {
        fireEvent.scroll(messagesContainer);
      }

      await waitFor(() => {
        expect(screen.queryByText('New messages')).not.toBeInTheDocument();
      });
    });

    it('scrolls to bottom when scroll button is clicked', async () => {
      const { container } = render(
        <MessageList 
          messages={Array.from({ length: 10 }, (_, i) => ({
            id: `msg-${i}`,
            text: `Message ${i}`,
            sender: i % 2 === 0 ? 'user' as const : 'ai' as const,
            timestamp: new Date(),
            status: MessageStatus.SENT
          }))}
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      
      // Mock scroll properties to show scroll button
      Object.defineProperty(messagesContainer, 'scrollTop', { value: 100, configurable: true });
      Object.defineProperty(messagesContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(messagesContainer, 'clientHeight', { value: 400, configurable: true });

      if (messagesContainer) {
        fireEvent.scroll(messagesContainer);
      }

      await waitFor(() => {
        expect(screen.getByText('New messages')).toBeInTheDocument();
      });

      const scrollButton = screen.getByLabelText('Scroll to bottom of conversation');
      fireEvent.click(scrollButton);

      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });
  });

  describe('History loading', () => {
    it('calls onScrollToTop when scrolling near top', async () => {
      const { container } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      
      // Mock scroll properties to simulate being near top
      Object.defineProperty(messagesContainer, 'scrollTop', { value: 30, configurable: true });
      Object.defineProperty(messagesContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(messagesContainer, 'clientHeight', { value: 400, configurable: true });

      if (messagesContainer) {
        fireEvent.scroll(messagesContainer);
      }

      await waitFor(() => {
        expect(mockOnScrollToTop).toHaveBeenCalled();
      });
    });

    it('shows history loading indicator when near top', async () => {
      const { container } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      
      // Mock scroll properties to simulate being near top
      Object.defineProperty(messagesContainer, 'scrollTop', { value: 30, configurable: true });
      Object.defineProperty(messagesContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(messagesContainer, 'clientHeight', { value: 400, configurable: true });

      if (messagesContainer) {
        fireEvent.scroll(messagesContainer);
      }

      await waitFor(() => {
        expect(screen.getByText('Loading conversation history...')).toBeInTheDocument();
      });
    });

    it('does not call onScrollToTop when no messages exist', async () => {
      const { container } = render(
        <MessageList 
          messages={[]} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      
      if (messagesContainer) {
        fireEvent.scroll(messagesContainer);
      }

      // Wait a bit to ensure no call happens
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockOnScrollToTop).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard navigation', () => {
    it('scrolls to top on Ctrl+Home', async () => {
      const { container } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      
      if (messagesContainer) {
        (messagesContainer as HTMLElement).focus();
        fireEvent.keyDown(messagesContainer, { key: 'Home', ctrlKey: true });
      }

      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('scrolls to bottom on Ctrl+End', async () => {
      const { container } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      
      if (messagesContainer) {
        (messagesContainer as HTMLElement).focus();
        fireEvent.keyDown(messagesContainer, { key: 'End', ctrlKey: true });
      }

      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls up on PageUp', async () => {
      const { container } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      Object.defineProperty(messagesContainer, 'clientHeight', { value: 400, configurable: true });
      
      if (messagesContainer) {
        (messagesContainer as HTMLElement).focus();
        fireEvent.keyDown(messagesContainer, { key: 'PageUp' });
      }

      expect(mockScrollBy).toHaveBeenCalledWith({ top: -320, behavior: 'smooth' }); // 80% of 400
    });

    it('scrolls down on PageDown', async () => {
      const { container } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      Object.defineProperty(messagesContainer, 'clientHeight', { value: 400, configurable: true });
      
      if (messagesContainer) {
        (messagesContainer as HTMLElement).focus();
        fireEvent.keyDown(messagesContainer, { key: 'PageDown' });
      }

      expect(mockScrollBy).toHaveBeenCalledWith({ top: 320, behavior: 'smooth' }); // 80% of 400
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const { container } = render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      expect(messagesContainer).toHaveAttribute('role', 'log');
      expect(messagesContainer).toHaveAttribute('aria-live', 'polite');
      expect(messagesContainer).toHaveAttribute('aria-label', 'Conversation history');
      expect(messagesContainer).toHaveAttribute('tabIndex', '0');
    });

    it('provides keyboard navigation instructions for screen readers', () => {
      render(
        <MessageList 
          messages={mockMessages} 
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      expect(screen.getByText(/Ctrl\+Home to scroll to top/)).toBeInTheDocument();
    });

    it('has proper button labels', async () => {
      const { container } = render(
        <MessageList 
          messages={Array.from({ length: 10 }, (_, i) => ({
            id: `msg-${i}`,
            text: `Message ${i}`,
            sender: i % 2 === 0 ? 'user' as const : 'ai' as const,
            timestamp: new Date(),
            status: MessageStatus.SENT
          }))}
          isLoading={false} 
          autoScroll={true}
          onScrollToTop={mockOnScrollToTop}
        />
      );

      const messagesContainer = container.querySelector('.messages-container');
      
      // Mock scroll to show button
      Object.defineProperty(messagesContainer, 'scrollTop', { value: 100, configurable: true });
      Object.defineProperty(messagesContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(messagesContainer, 'clientHeight', { value: 400, configurable: true });

      if (messagesContainer) {
        fireEvent.scroll(messagesContainer);
      }

      await waitFor(() => {
        const scrollButton = screen.getByLabelText('Scroll to bottom of conversation');
        expect(scrollButton).toHaveAttribute('title', 'Scroll to bottom');
      });
    });
  });
});