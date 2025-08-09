import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageItem } from '../components/MessageItem';
import { Message, MessageStatus } from '../types';

describe('MessageItem', () => {
  const mockUserMessage: Message = {
    id: '1',
    text: 'Hello, how are you?',
    sender: 'user',
    timestamp: new Date('2023-01-01T10:00:00Z'),
    status: MessageStatus.SENT
  };

  const mockAiMessage: Message = {
    id: '2',
    text: 'I am doing well, thank you for asking!',
    sender: 'ai',
    timestamp: new Date('2023-01-01T10:01:00Z'),
    status: MessageStatus.SENT
  };

  const mockMessageWithAudio: Message = {
    id: '3',
    text: 'This message has audio',
    sender: 'ai',
    timestamp: new Date('2023-01-01T10:02:00Z'),
    status: MessageStatus.SENT,
    audioUrl: 'https://example.com/audio.mp3'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('renders user message correctly', () => {
    render(<MessageItem message={mockUserMessage} />);

    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/)).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('renders AI message correctly', () => {
    render(<MessageItem message={mockAiMessage} />);

    expect(screen.getByText('I am doing well, thank you for asking!')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/)).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('applies correct CSS classes for user message', () => {
    const { container } = render(<MessageItem message={mockUserMessage} />);
    const messageElement = container.firstChild;

    expect(messageElement).toHaveClass('message-item');
    expect(messageElement).toHaveClass('message-user');
    expect(messageElement).toHaveClass('status-sent');
  });

  it('applies correct CSS classes for AI message', () => {
    const { container } = render(<MessageItem message={mockAiMessage} />);
    const messageElement = container.firstChild;

    expect(messageElement).toHaveClass('message-item');
    expect(messageElement).toHaveClass('message-ai');
    expect(messageElement).toHaveClass('status-sent');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MessageItem message={mockUserMessage} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('message-item', 'custom-class');
  });

  it('displays correct status icons', () => {
    const sendingMessage = { ...mockUserMessage, status: MessageStatus.SENDING };
    const errorMessage = { ...mockUserMessage, status: MessageStatus.ERROR };

    const { rerender } = render(<MessageItem message={sendingMessage} />);
    expect(screen.getByText('⏳')).toBeInTheDocument();

    rerender(<MessageItem message={errorMessage} />);
    expect(screen.getByText('❌')).toBeInTheDocument();

    rerender(<MessageItem message={mockUserMessage} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('formats timestamp correctly', () => {
    // Test different times
    const morningMessage = {
      ...mockUserMessage,
      timestamp: new Date('2023-01-01T09:30:00Z')
    };
    
    const afternoonMessage = {
      ...mockUserMessage,
      timestamp: new Date('2023-01-01T15:45:00Z')
    };

    const { rerender } = render(<MessageItem message={morningMessage} />);
    expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/)).toBeInTheDocument();

    rerender(<MessageItem message={afternoonMessage} />);
    expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/)).toBeInTheDocument();
  });

  it('renders audio button when audioUrl is present', () => {
    render(<MessageItem message={mockMessageWithAudio} />);

    const audioButton = screen.getByLabelText('Play audio');
    expect(audioButton).toBeInTheDocument();
    expect(screen.getByText('🔊 Play Audio')).toBeInTheDocument();
  });

  it('does not render audio button when audioUrl is not present', () => {
    render(<MessageItem message={mockUserMessage} />);

    expect(screen.queryByLabelText('Play audio')).not.toBeInTheDocument();
    expect(screen.queryByText('🔊 Play Audio')).not.toBeInTheDocument();
  });

  it('handles audio button click', () => {
    render(<MessageItem message={mockMessageWithAudio} />);

    const audioButton = screen.getByLabelText('Play audio');
    fireEvent.click(audioButton);

    // Should log that audio playback is not implemented
    expect(console.log).toHaveBeenCalledWith('Audio playback not yet implemented');
  });

  it('displays message text with proper formatting', () => {
    const multilineMessage = {
      ...mockUserMessage,
      text: 'Line 1\nLine 2\nLine 3'
    };

    render(<MessageItem message={multilineMessage} />);
    expect(screen.getByText((content, element) => {
      return element?.textContent === 'Line 1\nLine 2\nLine 3';
    })).toBeInTheDocument();
  });

  it('handles long message text', () => {
    const longMessage = {
      ...mockUserMessage,
      text: 'This is a very long message that should wrap properly and not break the layout. '.repeat(10)
    };

    render(<MessageItem message={longMessage} />);
    // Just check that the message text element exists and contains part of the text
    const messageTextElement = document.querySelector('.message-text');
    expect(messageTextElement).toBeInTheDocument();
    expect(messageTextElement?.textContent).toContain('This is a very long message');
  });

  it('applies correct status classes', () => {
    const sendingMessage = { ...mockUserMessage, status: MessageStatus.SENDING };
    const errorMessage = { ...mockUserMessage, status: MessageStatus.ERROR };

    const { rerender, container } = render(<MessageItem message={sendingMessage} />);
    expect(container.firstChild).toHaveClass('status-sending');

    rerender(<MessageItem message={errorMessage} />);
    expect(container.firstChild).toHaveClass('status-error');

    rerender(<MessageItem message={mockUserMessage} />);
    expect(container.firstChild).toHaveClass('status-sent');
  });
});