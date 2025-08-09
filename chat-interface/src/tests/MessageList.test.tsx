import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageList } from '../components/MessageList';
import { Message, MessageStatus } from '../types';

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no messages', () => {
    render(
      <MessageList 
        messages={[]} 
        isLoading={false} 
        autoScroll={true} 
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
        className="custom-class"
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
      />
    );

    expect(screen.getByText('AI is thinking...')).toBeInTheDocument();
    const typingDots = document.querySelector('.typing-dots');
    expect(typingDots).toBeInTheDocument();
    expect(typingDots?.children).toHaveLength(3);
  });

  it('handles scroll events', () => {
    const { container } = render(
      <MessageList 
        messages={mockMessages} 
        isLoading={false} 
        autoScroll={true} 
      />
    );

    const messagesContainer = container.querySelector('.messages-container');
    expect(messagesContainer).toBeInTheDocument();

    // Simulate scroll event
    if (messagesContainer) {
      fireEvent.scroll(messagesContainer, { target: { scrollTop: 100 } });
    }
  });

  it('renders messages in correct order', () => {
    render(
      <MessageList 
        messages={mockMessages} 
        isLoading={false} 
        autoScroll={true} 
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
      />
    );

    expect(screen.queryByText('AI is thinking...')).not.toBeInTheDocument();

    rerender(
      <MessageList 
        messages={mockMessages} 
        isLoading={true} 
        autoScroll={true} 
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
      />
    );

    expect(screen.getByText('Start a conversation by typing a message below')).toBeInTheDocument();
    expect(screen.queryByText('AI is thinking...')).not.toBeInTheDocument();
  });
});