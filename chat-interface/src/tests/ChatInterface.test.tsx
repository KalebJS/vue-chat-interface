import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInterface } from '../components/ChatInterface';
import { useStateManager } from '../hooks/useStateManager';
import { MessageStatus, ModelProvider, MemoryType, ChainType } from '../types';

// Mock the useStateManager hook
vi.mock('../hooks/useStateManager');

const mockUseStateManager = vi.mocked(useStateManager);

describe('ChatInterface', () => {
  const mockSendMessage = vi.fn();
  const mockUpdateCurrentInput = vi.fn();
  const mockUpdateError = vi.fn();

  const defaultState = {
    messages: [],
    currentInput: '',
    isLoading: false,
    audioState: {
      isRecording: false,
      isPlaying: false,
      isSupported: true,
      hasPermission: true
    },
    langChainState: {
      isInitialized: true,
      currentModel: 'test-model',
      conversationId: 'test-conversation',
      tokenCount: 0,
      memorySize: 0,
      isStreaming: false
    },
    error: undefined,
    settings: {
      autoScroll: true,
      audioEnabled: true,
      voiceSettings: {
        rate: 1,
        pitch: 1,
        voice: undefined
      },
      aiModel: {
        model: {
          provider: ModelProvider.OPENAI,
          modelName: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 1000
        },
        memory: {
          type: MemoryType.BUFFER,
          maxTokenLimit: 2000,
          returnMessages: true
        },
        chain: {
          type: ChainType.CONVERSATION,
          verbose: false
        }
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStateManager.mockReturnValue({
      state: defaultState,
      sendMessage: mockSendMessage,
      updateCurrentInput: mockUpdateCurrentInput,
      updateError: mockUpdateError,
      updateState: vi.fn(),
      updateMessages: vi.fn(),
      updateLoadingState: vi.fn(),
      updateAudioState: vi.fn(),
      updateLangChainState: vi.fn(),
      updateSettings: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
      loadConversationHistory: vi.fn(),
      loadMoreHistory: vi.fn(),
      resetState: vi.fn(),
      clearPersistedState: vi.fn(),
      initializeLangChain: vi.fn(),
      clearLangChainMemory: vi.fn(),
      stateManager: null,
      langChainService: null,
      getDebugInfo: vi.fn()
    });
  });

  it('renders loading state when state is null', () => {
    mockUseStateManager.mockReturnValue({
      state: null,
      sendMessage: mockSendMessage,
      updateCurrentInput: mockUpdateCurrentInput,
      updateError: mockUpdateError,
      updateState: vi.fn(),
      updateMessages: vi.fn(),
      updateLoadingState: vi.fn(),
      updateAudioState: vi.fn(),
      updateLangChainState: vi.fn(),
      updateSettings: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
      loadConversationHistory: vi.fn(),
      loadMoreHistory: vi.fn(),
      resetState: vi.fn(),
      clearPersistedState: vi.fn(),
      initializeLangChain: vi.fn(),
      clearLangChainMemory: vi.fn(),
      stateManager: null,
      langChainService: null,
      getDebugInfo: vi.fn()
    });

    render(<ChatInterface />);
    expect(screen.getByText('Initializing chat...')).toBeInTheDocument();
  });

  it('renders chat interface with header', () => {
    render(<ChatInterface />);
    expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
  });

  it('renders error banner when error exists', () => {
    const stateWithError = {
      ...defaultState,
      error: 'Test error message'
    };

    mockUseStateManager.mockReturnValue({
      state: stateWithError,
      sendMessage: mockSendMessage,
      updateCurrentInput: mockUpdateCurrentInput,
      updateError: mockUpdateError,
      updateState: vi.fn(),
      updateMessages: vi.fn(),
      updateLoadingState: vi.fn(),
      updateAudioState: vi.fn(),
      updateLangChainState: vi.fn(),
      updateSettings: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
      loadConversationHistory: vi.fn(),
      resetState: vi.fn(),
      clearPersistedState: vi.fn(),
      initializeLangChain: vi.fn(),
      clearLangChainMemory: vi.fn(),
      stateManager: null,
      langChainService: null,
      getDebugInfo: vi.fn()
    });

    render(<ChatInterface />);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('dismisses error when dismiss button is clicked', () => {
    const stateWithError = {
      ...defaultState,
      error: 'Test error message'
    };

    mockUseStateManager.mockReturnValue({
      state: stateWithError,
      sendMessage: mockSendMessage,
      updateCurrentInput: mockUpdateCurrentInput,
      updateError: mockUpdateError,
      updateState: vi.fn(),
      updateMessages: vi.fn(),
      updateLoadingState: vi.fn(),
      updateAudioState: vi.fn(),
      updateLangChainState: vi.fn(),
      updateSettings: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
      loadConversationHistory: vi.fn(),
      resetState: vi.fn(),
      clearPersistedState: vi.fn(),
      initializeLangChain: vi.fn(),
      clearLangChainMemory: vi.fn(),
      stateManager: null,
      langChainService: null,
      getDebugInfo: vi.fn()
    });

    render(<ChatInterface />);
    const dismissButton = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissButton);
    
    expect(mockUpdateError).toHaveBeenCalledWith(undefined);
  });

  it('handles message submission', async () => {
    const stateWithInput = {
      ...defaultState,
      currentInput: 'Test message'
    };

    mockUseStateManager.mockReturnValue({
      state: stateWithInput,
      sendMessage: mockSendMessage,
      updateCurrentInput: mockUpdateCurrentInput,
      updateError: mockUpdateError,
      updateState: vi.fn(),
      updateMessages: vi.fn(),
      updateLoadingState: vi.fn(),
      updateAudioState: vi.fn(),
      updateLangChainState: vi.fn(),
      updateSettings: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
      loadConversationHistory: vi.fn(),
      resetState: vi.fn(),
      clearPersistedState: vi.fn(),
      initializeLangChain: vi.fn(),
      clearLangChainMemory: vi.fn(),
      stateManager: null,
      langChainService: null,
      getDebugInfo: vi.fn()
    });

    mockSendMessage.mockResolvedValue(undefined);

    render(<ChatInterface />);
    
    // Find and click the send button
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
      expect(mockUpdateCurrentInput).toHaveBeenCalledWith('');
    });
  });

  it('handles message submission error', async () => {
    const stateWithInput = {
      ...defaultState,
      currentInput: 'Test message'
    };

    mockUseStateManager.mockReturnValue({
      state: stateWithInput,
      sendMessage: mockSendMessage,
      updateCurrentInput: mockUpdateCurrentInput,
      updateError: mockUpdateError,
      updateState: vi.fn(),
      updateMessages: vi.fn(),
      updateLoadingState: vi.fn(),
      updateAudioState: vi.fn(),
      updateLangChainState: vi.fn(),
      updateSettings: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
      loadConversationHistory: vi.fn(),
      resetState: vi.fn(),
      clearPersistedState: vi.fn(),
      initializeLangChain: vi.fn(),
      clearLangChainMemory: vi.fn(),
      stateManager: null,
      langChainService: null,
      getDebugInfo: vi.fn()
    });

    const testError = new Error('Send failed');
    mockSendMessage.mockRejectedValue(testError);

    render(<ChatInterface />);
    
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockUpdateError).toHaveBeenCalledWith('Send failed');
    });
  });

  it('does not submit empty messages', async () => {
    const stateWithEmptyInput = {
      ...defaultState,
      currentInput: '   '
    };

    mockUseStateManager.mockReturnValue({
      state: stateWithEmptyInput,
      sendMessage: mockSendMessage,
      updateCurrentInput: mockUpdateCurrentInput,
      updateError: mockUpdateError,
      updateState: vi.fn(),
      updateMessages: vi.fn(),
      updateLoadingState: vi.fn(),
      updateAudioState: vi.fn(),
      updateLangChainState: vi.fn(),
      updateSettings: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
      loadConversationHistory: vi.fn(),
      resetState: vi.fn(),
      clearPersistedState: vi.fn(),
      initializeLangChain: vi.fn(),
      clearLangChainMemory: vi.fn(),
      stateManager: null,
      langChainService: null,
      getDebugInfo: vi.fn()
    });

    render(<ChatInterface />);
    
    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(<ChatInterface className="custom-class" />);
    expect(container.firstChild).toHaveClass('chat-interface', 'custom-class');
  });

  it('renders MessageList and InputArea components', () => {
    render(<ChatInterface />);
    
    // Check for MessageList (empty state message)
    expect(screen.getByText('Start a conversation by typing a message below')).toBeInTheDocument();
    
    // Check for InputArea (placeholder text)
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });
});