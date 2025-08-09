import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../components/ChatInterface';
import { LangChainService } from '../services/LangChainService';
import { StateManager } from '../services/StateManager';

// Mock the LangChain service
vi.mock('../services/LangChainService');
const MockedLangChainService = vi.mocked(LangChainService);

// Mock environment variables for testing
vi.mock('process', () => ({
  env: {
    OPENAI_API_KEY: 'test-key'
  }
}));

describe('Message Flow Integration Tests', () => {
  let mockLangChainService: any;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    
    // Create mock LangChain service instance
    mockLangChainService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi.fn().mockResolvedValue('AI response'),
      getState: vi.fn().mockReturnValue({
        isInitialized: true,
        currentModel: 'openai:gpt-3.5-turbo',
        conversationId: 'test-conv-id',
        tokenCount: 0,
        memorySize: 0,
        isStreaming: false
      }),
      isInitialized: vi.fn().mockReturnValue(true),
      getConversationHistory: vi.fn().mockResolvedValue([]),
      clearMemory: vi.fn().mockResolvedValue(undefined),
      updateModelConfig: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn().mockReturnValue(null),
      dispose: vi.fn()
    };

    MockedLangChainService.mockImplementation(() => mockLangChainService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize LangChain service on mount', async () => {
    render(<ChatInterface />);

    await waitFor(() => {
      expect(mockLangChainService.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({
            provider: 'openai',
            modelName: 'gpt-3.5-turbo'
          })
        })
      );
    });
  });

  it('should show loading state during initialization', async () => {
    mockLangChainService.isInitialized.mockReturnValue(false);
    mockLangChainService.getState.mockReturnValue({
      isInitialized: false,
      currentModel: '',
      conversationId: '',
      tokenCount: 0,
      memorySize: 0,
      isStreaming: false
    });

    render(<ChatInterface />);

    expect(screen.getByText('Initializing AI model...')).toBeInTheDocument();
  });

  it('should send message and display user and AI responses', async () => {
    render(<ChatInterface />);

    // Wait for initialization
    await waitFor(() => {
      expect(mockLangChainService.initialize).toHaveBeenCalled();
    });

    // Find input and send button
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByLabelText('Send message');

    // Type a message
    await user.type(input, 'Hello, AI!');
    expect(input).toHaveValue('Hello, AI!');

    // Send the message
    await user.click(sendButton);

    // Check that user message appears
    await waitFor(() => {
      expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
      expect(screen.getByText('You')).toBeInTheDocument();
    });

    // Check that LangChain service was called
    expect(mockLangChainService.sendMessage).toHaveBeenCalledWith('Hello, AI!');

    // Check that AI response appears
    await waitFor(() => {
      expect(screen.getByText('AI response')).toBeInTheDocument();
      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    // Check that input is cleared
    expect(input).toHaveValue('');
  });

  it('should prevent sending empty messages', async () => {
    render(<ChatInterface />);

    await waitFor(() => {
      expect(mockLangChainService.initialize).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByLabelText('Send message');

    // Try to send empty message
    await user.click(sendButton);

    // Should not call LangChain service
    expect(mockLangChainService.sendMessage).not.toHaveBeenCalled();

    // Try with whitespace only
    await user.type(input, '   ');
    await user.click(sendButton);

    // Should still not call LangChain service
    expect(mockLangChainService.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle message sending with Enter key', async () => {
    render(<ChatInterface />);

    await waitFor(() => {
      expect(mockLangChainService.initialize).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText('Type your message...');

    // Type message and press Enter
    await user.type(input, 'Test message{enter}');

    // Check that message was sent
    expect(mockLangChainService.sendMessage).toHaveBeenCalledWith('Test message');

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  it('should show loading state while sending message', async () => {
    // Make sendMessage take some time
    mockLangChainService.sendMessage.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('Delayed response'), 100))
    );

    render(<ChatInterface />);

    await waitFor(() => {
      expect(mockLangChainService.initialize).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByLabelText('Send message');

    await user.type(input, 'Test message');
    await user.click(sendButton);

    // Check loading state
    expect(screen.getByText('AI is thinking...')).toBeInTheDocument();
    expect(sendButton).toBeDisabled();

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText('Delayed response')).toBeInTheDocument();
    });

    // Loading should be gone
    expect(screen.queryByText('AI is thinking...')).not.toBeInTheDocument();
    
    // Input should be cleared and button should be enabled when user types again
    await user.type(input, 'New message');
    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    });
  });

  it('should handle LangChain service errors gracefully', async () => {
    mockLangChainService.sendMessage.mockRejectedValue(new Error('API Error'));

    render(<ChatInterface />);

    await waitFor(() => {
      expect(mockLangChainService.initialize).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByLabelText('Send message');

    await user.type(input, 'Test message');
    await user.click(sendButton);

    // User message should still appear in the message list
    await waitFor(() => {
      const messageElements = screen.getAllByText('Test message');
      // Should find the message in the message list (not just the input)
      const messageInList = messageElements.find(el => 
        el.closest('.message-item')
      );
      expect(messageInList).toBeInTheDocument();
    });

    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });

    // User message should show error status
    const errorIcon = screen.getByLabelText('Message error');
    expect(errorIcon).toBeInTheDocument();
  });

  it('should handle initialization errors', async () => {
    mockLangChainService.initialize.mockRejectedValue(new Error('Init failed'));
    mockLangChainService.isInitialized.mockReturnValue(false);

    render(<ChatInterface />);

    await waitFor(() => {
      expect(screen.getByText('Init failed')).toBeInTheDocument();
    });
  });

  it('should prevent sending messages when not initialized', async () => {
    mockLangChainService.isInitialized.mockReturnValue(false);
    mockLangChainService.getState.mockReturnValue({
      isInitialized: false,
      currentModel: '',
      conversationId: '',
      tokenCount: 0,
      memorySize: 0,
      isStreaming: false
    });

    render(<ChatInterface />);

    // Wait a bit for any initialization attempts
    await new Promise(resolve => setTimeout(resolve, 50));

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByLabelText('Send message');

    await user.type(input, 'Test message');
    await user.click(sendButton);

    // Should show error about not being initialized
    await waitFor(() => {
      expect(screen.getByText(/AI model not initialized/)).toBeInTheDocument();
    });

    // Should not call sendMessage
    expect(mockLangChainService.sendMessage).not.toHaveBeenCalled();
  });

  it('should display conversation context through LangChain memory', async () => {
    render(<ChatInterface />);

    await waitFor(() => {
      expect(mockLangChainService.initialize).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText('Type your message...');

    // Send first message
    await user.type(input, 'First message');
    await user.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(screen.getByText('First message')).toBeInTheDocument();
    });

    // Send second message
    await user.type(input, 'Second message');
    await user.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(screen.getByText('Second message')).toBeInTheDocument();
    });

    // Both messages should be visible (conversation context)
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();

    // LangChain should have been called twice
    expect(mockLangChainService.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('should update message status correctly during send flow', async () => {
    let resolveMessage: (value: string) => void;
    const messagePromise = new Promise<string>((resolve) => {
      resolveMessage = resolve;
    });
    
    mockLangChainService.sendMessage.mockReturnValue(messagePromise);

    render(<ChatInterface />);

    await waitFor(() => {
      expect(mockLangChainService.initialize).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Test message');
    await user.click(screen.getByLabelText('Send message'));

    // Message should appear in the message list
    await waitFor(() => {
      const messageElements = screen.getAllByText('Test message');
      const messageInList = messageElements.find(el => 
        el.closest('.message-item')
      );
      expect(messageInList).toBeInTheDocument();
    });

    // Should show loading indicator
    expect(screen.getByText('AI is thinking...')).toBeInTheDocument();

    // Resolve the message
    resolveMessage!('AI response');

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('AI response')).toBeInTheDocument();
    });

    // Loading should be gone
    expect(screen.queryByText('AI is thinking...')).not.toBeInTheDocument();

    // Message should show sent status (checkmark) - check for user message specifically
    const sentIcons = screen.getAllByLabelText('Message sent');
    expect(sentIcons.length).toBeGreaterThan(0);
  });
});