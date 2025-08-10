import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateManager } from '../services/StateManager';
import { LangChainService } from '../services/LangChainService';
import { 
  AppState, 
  Message, 
  MessageStatus, 
  ModelProvider, 
  MemoryType, 
  ChainType 
} from '../types';

// Mock LangChainService
vi.mock('../services/LangChainService');

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('StateManager', () => {
  let stateManager: StateManager;
  let mockLangChainService: LangChainService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    mockLangChainService = new LangChainService();
    vi.mocked(mockLangChainService.isInitialized).mockReturnValue(false);
    vi.mocked(mockLangChainService.getState).mockReturnValue({
      isInitialized: false,
      currentModel: '',
      conversationId: 'test-conv-id',
      tokenCount: 0,
      memorySize: 0,
      isStreaming: false
    });
    
    stateManager = new StateManager(mockLangChainService);
  });

  afterEach(() => {
    stateManager.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = stateManager.getState();
      
      expect(state.messages).toEqual([]);
      expect(state.currentInput).toBe('');
      expect(state.isLoading).toBe(false);
      expect(state.audioState.isRecording).toBe(false);
      expect(state.langChainState.isInitialized).toBe(false);
      expect(state.settings.autoScroll).toBe(true);
      expect(state.settings.aiModel.model.provider).toBe(ModelProvider.OPENAI);
    });

    it('should load persisted state from localStorage', () => {
      const persistedState = {
        messages: [{
          id: 'test-1',
          text: 'Hello',
          sender: 'user',
          timestamp: '2023-01-01T00:00:00.000Z',
          status: MessageStatus.SENT
        }],
        settings: {
          autoScroll: false,
          audioEnabled: false
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(persistedState));
      
      const newStateManager = new StateManager(mockLangChainService);
      const state = newStateManager.getState();
      
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toBe('Hello');
      expect(state.settings.autoScroll).toBe(false);
      expect(state.settings.audioEnabled).toBe(false);
      
      newStateManager.dispose();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');
      
      const newStateManager = new StateManager(mockLangChainService);
      const state = newStateManager.getState();
      
      // Should fall back to default state
      expect(state.messages).toEqual([]);
      expect(state.settings.autoScroll).toBe(true);
      
      newStateManager.dispose();
    });
  });

  describe('State Updates', () => {
    it('should update state with partial updates', () => {
      const callback = vi.fn();
      stateManager.subscribe(callback);
      
      stateManager.setState({ isLoading: true, currentInput: 'test input' });
      
      const state = stateManager.getState();
      expect(state.isLoading).toBe(true);
      expect(state.currentInput).toBe('test input');
      expect(callback).toHaveBeenCalledWith(state);
    });

    it('should update messages', () => {
      const messages: Message[] = [{
        id: 'test-1',
        text: 'Hello',
        sender: 'user',
        timestamp: new Date(),
        status: MessageStatus.SENT
      }];
      
      stateManager.updateMessages(messages);
      
      expect(stateManager.getState().messages).toEqual(messages);
    });

    it('should update current input', () => {
      stateManager.updateCurrentInput('test input');
      expect(stateManager.getState().currentInput).toBe('test input');
    });

    it('should update loading state', () => {
      stateManager.updateLoadingState(true);
      expect(stateManager.getState().isLoading).toBe(true);
    });

    it('should update audio state', () => {
      stateManager.updateAudioState({ isRecording: true, hasPermission: true });
      
      const audioState = stateManager.getState().audioState;
      expect(audioState.isRecording).toBe(true);
      expect(audioState.hasPermission).toBe(true);
      expect(audioState.isPlaying).toBe(false); // Should preserve other properties
    });

    it('should update LangChain state', () => {
      stateManager.updateLangChainState({ isInitialized: true, tokenCount: 100 });
      
      const langChainState = stateManager.getState().langChainState;
      expect(langChainState.isInitialized).toBe(true);
      expect(langChainState.tokenCount).toBe(100);
    });

    it('should update settings', () => {
      stateManager.updateSettings({ autoScroll: false });
      
      const settings = stateManager.getState().settings;
      expect(settings.autoScroll).toBe(false);
      expect(settings.audioEnabled).toBe(true); // Should preserve other properties
    });

    it('should update error', () => {
      stateManager.updateError('Test error');
      expect(stateManager.getState().error).toBe('Test error');
      
      stateManager.updateError(undefined);
      expect(stateManager.getState().error).toBeUndefined();
    });
  });

  describe('Message Management', () => {
    it('should add a new message', () => {
      stateManager.addMessage({
        text: 'Hello',
        sender: 'user',
        status: MessageStatus.SENT
      });
      
      const messages = stateManager.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].text).toBe('Hello');
      expect(messages[0].sender).toBe('user');
      expect(messages[0].id).toBeDefined();
      expect(messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should update an existing message', () => {
      stateManager.addMessage({
        text: 'Hello',
        sender: 'user',
        status: MessageStatus.SENDING
      });
      
      const messageId = stateManager.getState().messages[0].id;
      
      stateManager.updateMessage(messageId, { 
        status: MessageStatus.SENT,
        text: 'Hello World'
      });
      
      const updatedMessage = stateManager.getState().messages[0];
      expect(updatedMessage.status).toBe(MessageStatus.SENT);
      expect(updatedMessage.text).toBe('Hello World');
    });

    it('should clear all messages', () => {
      stateManager.addMessage({
        text: 'Hello',
        sender: 'user',
        status: MessageStatus.SENT
      });
      
      expect(stateManager.getState().messages).toHaveLength(1);
      
      stateManager.clearMessages();
      expect(stateManager.getState().messages).toHaveLength(0);
    });
  });

  describe('Subscription Management', () => {
    it('should notify subscribers of state changes', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      stateManager.subscribe(callback1);
      stateManager.subscribe(callback2);
      
      stateManager.setState({ isLoading: true });
      
      expect(callback1).toHaveBeenCalledWith(stateManager.getState());
      expect(callback2).toHaveBeenCalledWith(stateManager.getState());
    });

    it('should allow unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = stateManager.subscribe(callback);
      
      stateManager.setState({ isLoading: true });
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      stateManager.setState({ isLoading: false });
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      
      stateManager.subscribe(errorCallback);
      stateManager.subscribe(normalCallback);
      
      // Should not throw and should still call other callbacks
      expect(() => {
        stateManager.setState({ isLoading: true });
      }).not.toThrow();
      
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('LangChain Synchronization', () => {
    it('should sync LangChain state when service is initialized', () => {
      const mockState = {
        isInitialized: true,
        currentModel: 'gpt-4',
        conversationId: 'test-conv',
        tokenCount: 150,
        memorySize: 1024,
        isStreaming: false
      };
      
      vi.mocked(mockLangChainService.isInitialized).mockReturnValue(true);
      vi.mocked(mockLangChainService.getState).mockReturnValue(mockState);
      
      stateManager.setState({ isLoading: true }); // Trigger sync
      
      expect(stateManager.getState().langChainState).toEqual(mockState);
    });

    it('should update LangChain model config when settings change', async () => {
      vi.mocked(mockLangChainService.isInitialized).mockReturnValue(true);
      vi.mocked(mockLangChainService.updateModelConfig).mockResolvedValue();
      
      const newModelConfig = {
        provider: ModelProvider.ANTHROPIC,
        modelName: 'claude-3',
        temperature: 0.5,
        maxTokens: 2000
      };
      
      stateManager.updateSettings({
        aiModel: {
          model: newModelConfig,
          memory: { type: MemoryType.BUFFER },
          chain: { type: ChainType.CONVERSATION }
        }
      });
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockLangChainService.updateModelConfig).toHaveBeenCalledWith(newModelConfig);
    });

    it('should load conversation history from LangChain service', async () => {
      const mockHistory: Message[] = [{
        id: 'hist-1',
        text: 'Previous message',
        sender: 'user',
        timestamp: new Date(),
        status: MessageStatus.SENT
      }];
      
      vi.mocked(mockLangChainService.isInitialized).mockReturnValue(true);
      vi.mocked(mockLangChainService.getConversationHistory).mockResolvedValue(mockHistory);
      
      await stateManager.loadConversationHistory();
      
      expect(stateManager.getState().messages).toEqual(mockHistory);
    });

    it('should merge localStorage and LangChain history without duplicates', async () => {
      // Set up localStorage history
      const localHistory = [{
        id: 'local-1',
        text: 'Local message',
        sender: 'user',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        status: MessageStatus.SENT
      }];
      
      const persistedState = {
        messages: localHistory,
        settings: { autoScroll: true }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(persistedState));
      
      // Create new state manager to load persisted state
      const newStateManager = new StateManager(mockLangChainService);
      
      // Set up LangChain history with one duplicate and one new message
      const langChainHistory: Message[] = [
        {
          id: 'local-1-duplicate',
          text: 'Local message', // Same text as local message
          sender: 'user',
          timestamp: new Date('2023-01-01T10:00:00Z'), // Same timestamp
          status: MessageStatus.SENT
        },
        {
          id: 'langchain-1',
          text: 'LangChain message',
          sender: 'ai',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          status: MessageStatus.SENT
        }
      ];
      
      vi.mocked(mockLangChainService.isInitialized).mockReturnValue(true);
      vi.mocked(mockLangChainService.getConversationHistory).mockResolvedValue(langChainHistory);
      
      await newStateManager.loadConversationHistory();
      
      const messages = newStateManager.getState().messages;
      
      // Should have 2 messages (duplicate removed)
      expect(messages).toHaveLength(2);
      expect(messages.find(m => m.text === 'Local message')).toBeDefined();
      expect(messages.find(m => m.text === 'LangChain message')).toBeDefined();
      
      // Messages should be sorted by timestamp
      expect(messages[0].text).toBe('Local message');
      expect(messages[1].text).toBe('LangChain message');
      
      newStateManager.dispose();
    });

    it('should handle loadMoreHistory method', async () => {
      vi.mocked(mockLangChainService.isInitialized).mockReturnValue(true);
      
      const moreHistory = await stateManager.loadMoreHistory('message-id');
      
      // Currently returns empty array as pagination is not implemented
      expect(moreHistory).toEqual([]);
    });

    it('should handle loadMoreHistory when service not initialized', async () => {
      vi.mocked(mockLangChainService.isInitialized).mockReturnValue(false);
      
      const moreHistory = await stateManager.loadMoreHistory('message-id');
      
      expect(moreHistory).toEqual([]);
    });

    it('should handle LangChain errors gracefully', async () => {
      vi.mocked(mockLangChainService.isInitialized).mockReturnValue(true);
      vi.mocked(mockLangChainService.getConversationHistory).mockRejectedValue(
        new Error('LangChain error')
      );
      
      await stateManager.loadConversationHistory();
      
      expect(stateManager.getState().error).toBe('Failed to load conversation history');
    });
  });

  describe('Persistence', () => {
    it('should persist state to localStorage on updates', () => {
      stateManager.addMessage({
        text: 'Test message',
        sender: 'user',
        status: MessageStatus.SENT
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'chat-interface-state',
        expect.stringContaining('Test message')
      );
    });

    it('should not persist temporary state properties', () => {
      stateManager.setState({ 
        isLoading: true, 
        currentInput: 'temp input',
        error: 'temp error'
      });
      
      const persistedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(persistedData.isLoading).toBeUndefined();
      expect(persistedData.currentInput).toBeUndefined();
      expect(persistedData.error).toBeUndefined();
      expect(persistedData.messages).toBeDefined();
      expect(persistedData.settings).toBeDefined();
    });

    it('should clear persisted state', () => {
      stateManager.clearPersistedState();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('chat-interface-state');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw
      expect(() => {
        stateManager.setState({ isLoading: true });
      }).not.toThrow();
    });
  });

  describe('State Reset', () => {
    it('should reset state to initial values', () => {
      // Modify state
      stateManager.addMessage({
        text: 'Test',
        sender: 'user',
        status: MessageStatus.SENT
      });
      stateManager.setState({ isLoading: true, error: 'test error' });
      
      // Reset
      stateManager.resetState();
      
      const state = stateManager.getState();
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeUndefined();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('chat-interface-state');
    });
  });

  describe('Debug Information', () => {
    it('should provide debug information', () => {
      stateManager.addMessage({
        text: 'Test',
        sender: 'user',
        status: MessageStatus.SENT
      });
      
      const callback = vi.fn();
      stateManager.subscribe(callback);
      
      const debugInfo = stateManager.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('stateSize');
      expect(debugInfo).toHaveProperty('messageCount', 1);
      expect(debugInfo).toHaveProperty('subscriberCount', 1);
      expect(debugInfo).toHaveProperty('langChainInitialized', false);
      expect(debugInfo).toHaveProperty('persistedStateExists');
    });
  });

  describe('Streaming functionality', () => {
    beforeEach(() => {
      vi.mocked(mockLangChainService.isInitialized).mockReturnValue(true);
      vi.mocked(mockLangChainService.sendMessageStreaming).mockImplementation(
        async (message, options) => {
          // Simulate streaming tokens
          const words = 'Hello there friend'.split(' ');
          for (const word of words) {
            const token = word === words[0] ? word : ' ' + word;
            options.onToken?.(token);
          }
          const fullResponse = 'Hello there friend';
          options.onComplete?.(fullResponse);
          return fullResponse;
        }
      );
    });

    it('should start message streaming', () => {
      stateManager.addMessage({
        text: '',
        sender: 'ai',
        status: MessageStatus.SENDING
      });
      
      const messageId = stateManager.getState().messages[0].id;
      stateManager.startMessageStreaming(messageId);
      
      const state = stateManager.getState();
      const message = state.messages[0];
      
      expect(message.isStreaming).toBe(true);
      expect(message.streamingComplete).toBe(false);
      expect(state.langChainState.isStreaming).toBe(true);
      expect(state.langChainState.streamingMessageId).toBe(messageId);
    });

    it('should update streaming message with tokens', () => {
      stateManager.addMessage({
        text: '',
        sender: 'ai',
        status: MessageStatus.SENDING,
        isStreaming: true
      });
      
      const messageId = stateManager.getState().messages[0].id;
      
      stateManager.updateStreamingMessage(messageId, 'Hello');
      stateManager.updateStreamingMessage(messageId, ' world');
      
      const message = stateManager.getState().messages[0];
      expect(message.text).toBe('Hello world');
    });

    it('should complete message streaming', () => {
      stateManager.addMessage({
        text: 'Hello',
        sender: 'ai',
        status: MessageStatus.SENDING,
        isStreaming: true
      });
      
      const messageId = stateManager.getState().messages[0].id;
      stateManager.completeMessageStreaming(messageId, 'Hello world complete');
      
      const state = stateManager.getState();
      const message = state.messages[0];
      
      expect(message.text).toBe('Hello world complete');
      expect(message.isStreaming).toBe(false);
      expect(message.streamingComplete).toBe(true);
      expect(message.status).toBe(MessageStatus.SENT);
      expect(state.langChainState.isStreaming).toBe(false);
      expect(state.langChainState.streamingMessageId).toBeUndefined();
    });

    it('should handle streaming errors', () => {
      stateManager.addMessage({
        text: 'Hello',
        sender: 'ai',
        status: MessageStatus.SENDING,
        isStreaming: true
      });
      
      const messageId = stateManager.getState().messages[0].id;
      stateManager.handleStreamingError(messageId, 'Streaming failed');
      
      const state = stateManager.getState();
      const message = state.messages[0];
      
      expect(message.isStreaming).toBe(false);
      expect(message.streamingComplete).toBe(false);
      expect(message.status).toBe(MessageStatus.ERROR);
      expect(state.langChainState.isStreaming).toBe(false);
      expect(state.langChainState.streamingMessageId).toBeUndefined();
      expect(state.error).toBe('Streaming failed');
    });

    it('should send message with streaming enabled', async () => {
      const callback = vi.fn();
      stateManager.subscribe(callback);
      
      await stateManager.sendMessageWithStreaming('Hello AI', true);
      
      const state = stateManager.getState();
      
      // Should have user message and AI message
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].text).toBe('Hello AI');
      expect(state.messages[0].sender).toBe('user');
      expect(state.messages[1].text).toBe('Hello there friend');
      expect(state.messages[1].sender).toBe('ai');
      expect(state.messages[1].streamingComplete).toBe(true);
      
      expect(mockLangChainService.sendMessageStreaming).toHaveBeenCalledWith(
        'Hello AI',
        expect.objectContaining({
          onToken: expect.any(Function),
          onComplete: expect.any(Function),
          onError: expect.any(Function)
        })
      );
    });

    it('should send message with streaming disabled', async () => {
      vi.mocked(mockLangChainService.sendMessage).mockResolvedValue('Regular response');
      
      await stateManager.sendMessageWithStreaming('Hello AI', false);
      
      const state = stateManager.getState();
      
      // Should have user message and AI message
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].text).toBe('Hello AI');
      expect(state.messages[0].sender).toBe('user');
      expect(state.messages[1].text).toBe('Regular response');
      expect(state.messages[1].sender).toBe('ai');
      expect(state.messages[1].isStreaming).toBeUndefined();
      
      expect(mockLangChainService.sendMessage).toHaveBeenCalledWith('Hello AI');
      expect(mockLangChainService.sendMessageStreaming).not.toHaveBeenCalled();
    });

    it('should handle streaming abort signal', async () => {
      const abortController = new AbortController();
      
      vi.mocked(mockLangChainService.sendMessageStreaming).mockImplementation(
        async (message, options) => {
          if (options.signal?.aborted) {
            const error = new Error('Request aborted');
            options.onError?.(error);
            throw error;
          }
          return 'Response';
        }
      );
      
      abortController.abort();
      
      await expect(
        stateManager.sendMessageWithStreaming('Hello', true, abortController.signal)
      ).rejects.toThrow();
      
      const state = stateManager.getState();
      expect(state.messages[1].status).toBe(MessageStatus.ERROR);
    });

    it('should not update non-streaming messages', () => {
      stateManager.addMessage({
        text: 'Hello',
        sender: 'ai',
        status: MessageStatus.SENT,
        isStreaming: false
      });
      
      const messageId = stateManager.getState().messages[0].id;
      const originalText = stateManager.getState().messages[0].text;
      
      stateManager.updateStreamingMessage(messageId, ' world');
      
      const message = stateManager.getState().messages[0];
      expect(message.text).toBe(originalText); // Should not change
    });
  });

  describe('Cleanup', () => {
    it('should dispose resources properly', () => {
      const callback = vi.fn();
      stateManager.subscribe(callback);
      
      stateManager.dispose();
      
      // Should persist state one final time
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Callbacks should be cleared
      stateManager.setState({ isLoading: true });
      expect(callback).not.toHaveBeenCalled();
    });
  });
});