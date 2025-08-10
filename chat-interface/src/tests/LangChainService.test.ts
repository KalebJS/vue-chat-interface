import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { LangChainService } from '../services/LangChainService';
import { NetworkErrorHandler } from '../services/NetworkErrorHandler';
import { 
  LangChainConfig, 
  ModelProvider, 
  MemoryType, 
  ChainType,
  LangChainError,
  LangChainErrorCode,
  NetworkError,
  NetworkErrorCode
} from '../types';

// Mock NetworkErrorHandler
jest.mock('../services/NetworkErrorHandler');
const mockNetworkErrorHandler = NetworkErrorHandler as jest.Mocked<typeof NetworkErrorHandler>;

// Mock LangChain modules
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    call: vi.fn().mockResolvedValue({ content: 'Mocked OpenAI response' })
  }))
}));

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    call: vi.fn().mockResolvedValue({ content: 'Mocked Anthropic response' })
  }))
}));

vi.mock('langchain/chains', () => ({
  ConversationChain: vi.fn().mockImplementation(({ llm, memory, verbose }) => ({
    llm,
    memory,
    verbose,
    call: vi.fn().mockResolvedValue({ response: 'Mocked chain response' })
  }))
}));

vi.mock('langchain/memory', () => ({
  BufferMemory: vi.fn().mockImplementation(() => ({
    loadMemoryVariables: vi.fn().mockResolvedValue({ 
      history: [
        { type: 'human', content: 'Hello' },
        { type: 'ai', content: 'Hi there!' }
      ] 
    }),
    clear: vi.fn().mockResolvedValue(undefined)
  })),
  ConversationSummaryMemory: vi.fn().mockImplementation(() => ({
    loadMemoryVariables: vi.fn().mockResolvedValue({ 
      history: [
        { type: 'human', content: 'Hello' },
        { type: 'ai', content: 'Hi there!' }
      ] 
    }),
    clear: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('LangChainService', () => {
  let service: LangChainService;
  let mockConfig: LangChainConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LangChainService();
    
    mockConfig = {
      model: {
        provider: ModelProvider.OPENAI,
        modelName: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000
      },
      memory: {
        type: MemoryType.BUFFER,
        returnMessages: true
      },
      chain: {
        type: ChainType.CONVERSATION,
        verbose: false
      }
    };
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const state = service.getState();
      
      expect(state.isInitialized).toBe(false);
      expect(state.currentModel).toBe('');
      expect(state.tokenCount).toBe(0);
      expect(state.memorySize).toBe(0);
      expect(state.isStreaming).toBe(false);
      expect(state.conversationId).toMatch(/^conv_\d+_[a-z0-9]+$/);
    });

    it('should not be initialized initially', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('should return null config initially', () => {
      expect(service.getConfig()).toBeNull();
    });
  });

  describe('initialize method', () => {
    it('should initialize successfully with OpenAI config', async () => {
      await service.initialize(mockConfig);
      
      const state = service.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.currentModel).toBe('openai:gpt-3.5-turbo');
      expect(service.isInitialized()).toBe(true);
    });

    it('should initialize successfully with Anthropic config', async () => {
      const anthropicConfig = {
        ...mockConfig,
        model: {
          ...mockConfig.model,
          provider: ModelProvider.ANTHROPIC,
          modelName: 'claude-3-sonnet-20240229'
        }
      };

      await service.initialize(anthropicConfig);
      
      const state = service.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.currentModel).toBe('anthropic:claude-3-sonnet-20240229');
    });

    it('should initialize with summary memory', async () => {
      const summaryConfig = {
        ...mockConfig,
        memory: {
          type: MemoryType.SUMMARY,
          maxTokenLimit: 2000,
          returnMessages: true
        }
      };

      await service.initialize(summaryConfig);
      
      expect(service.isInitialized()).toBe(true);
    });

    it('should throw error for unsupported model provider', async () => {
      const invalidConfig = {
        ...mockConfig,
        model: {
          ...mockConfig.model,
          provider: 'invalid' as ModelProvider
        }
      };

      try {
        await service.initialize(invalidConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(LangChainError);
        expect((error as LangChainError).code).toBe(LangChainErrorCode.INITIALIZATION_FAILED);
        expect((error as LangChainError).originalError?.message).toContain('Unsupported model provider');
      }
    });

    it('should throw error for local model provider (not implemented)', async () => {
      const localConfig = {
        ...mockConfig,
        model: {
          ...mockConfig.model,
          provider: ModelProvider.LOCAL
        }
      };

      try {
        await service.initialize(localConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(LangChainError);
        expect((error as LangChainError).code).toBe(LangChainErrorCode.INITIALIZATION_FAILED);
        expect((error as LangChainError).originalError?.message).toContain('Local model provider not yet implemented');
      }
    });

    it('should throw error for vector memory type (not implemented)', async () => {
      const vectorConfig = {
        ...mockConfig,
        memory: {
          type: MemoryType.VECTOR,
          returnMessages: true
        }
      };

      try {
        await service.initialize(vectorConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(LangChainError);
        expect((error as LangChainError).code).toBe(LangChainErrorCode.INITIALIZATION_FAILED);
        expect((error as LangChainError).originalError?.message).toContain('Vector memory type not yet implemented');
      }
    });

    it('should store configuration after successful initialization', async () => {
      await service.initialize(mockConfig);
      
      const storedConfig = service.getConfig();
      expect(storedConfig).toEqual(mockConfig);
    });
  });

  describe('sendMessage method', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should send message and return response', async () => {
      const message = 'Hello, AI!';
      const response = await service.sendMessage(message);
      
      expect(response).toBe('Mocked chain response');
    });

    it('should update token count after sending message', async () => {
      const initialState = service.getState();
      const initialTokenCount = initialState.tokenCount;
      
      await service.sendMessage('Hello, AI!');
      
      const updatedState = service.getState();
      expect(updatedState.tokenCount).toBeGreaterThan(initialTokenCount);
    });

    it('should throw error when not initialized', async () => {
      const uninitializedService = new LangChainService();
      
      await expect(uninitializedService.sendMessage('Hello')).rejects.toThrow(LangChainError);
      await expect(uninitializedService.sendMessage('Hello')).rejects.toThrow('LangChain service not initialized');
    });
  });

  describe('getConversationHistory method', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should return conversation history', async () => {
      const history = await service.getConversationHistory();
      
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(2);
      expect(history[0].sender).toBe('user');
      expect(history[0].text).toBe('Hello');
      expect(history[1].sender).toBe('ai');
      expect(history[1].text).toBe('Hi there!');
    });

    it('should return empty array when no memory', async () => {
      const serviceWithoutMemory = new LangChainService();
      const history = await serviceWithoutMemory.getConversationHistory();
      
      expect(history).toEqual([]);
    });
  });

  describe('updateModelConfig method', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should update model configuration', async () => {
      const newModelConfig = {
        provider: ModelProvider.ANTHROPIC,
        modelName: 'claude-3-sonnet-20240229',
        temperature: 0.5,
        maxTokens: 2000
      };

      await service.updateModelConfig(newModelConfig);
      
      const state = service.getState();
      expect(state.currentModel).toBe('anthropic:claude-3-sonnet-20240229');
      
      const config = service.getConfig();
      expect(config?.model).toEqual(newModelConfig);
    });

    it('should throw error when service not initialized', async () => {
      const uninitializedService = new LangChainService();
      const newModelConfig = {
        provider: ModelProvider.OPENAI,
        modelName: 'gpt-4',
        temperature: 0.5,
        maxTokens: 2000
      };

      await expect(uninitializedService.updateModelConfig(newModelConfig)).rejects.toThrow(LangChainError);
    });
  });

  describe('clearMemory method', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should clear memory and reset counters', async () => {
      // First send a message to populate memory
      await service.sendMessage('Hello');
      
      // Clear memory
      await service.clearMemory();
      
      const state = service.getState();
      expect(state.memorySize).toBe(0);
      expect(state.tokenCount).toBe(0);
    });

    it('should handle clearing memory when no memory exists', async () => {
      const serviceWithoutMemory = new LangChainService();
      
      // Should not throw error
      await expect(serviceWithoutMemory.clearMemory()).resolves.toBeUndefined();
    });
  });

  describe('dispose method', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should dispose of all resources and reset state', () => {
      service.dispose();
      
      const state = service.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.currentModel).toBe('');
      expect(state.tokenCount).toBe(0);
      expect(state.memorySize).toBe(0);
      expect(service.isInitialized()).toBe(false);
      expect(service.getConfig()).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw LangChainError with correct error codes', async () => {
      const invalidConfig = {
        ...mockConfig,
        model: {
          ...mockConfig.model,
          provider: 'invalid' as ModelProvider
        }
      };

      try {
        await service.initialize(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(LangChainError);
        expect((error as LangChainError).code).toBe(LangChainErrorCode.INITIALIZATION_FAILED);
      }
    });

    it('should preserve original error in LangChainError', async () => {
      const mockError = new Error('Original error');
      
      // Mock the ChatOpenAI constructor to throw an error
      const { ChatOpenAI } = await import('@langchain/openai');
      (ChatOpenAI as Mock).mockImplementationOnce(() => {
        throw mockError;
      });

      try {
        await service.initialize(mockConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(LangChainError);
        expect((error as LangChainError).code).toBe(LangChainErrorCode.INITIALIZATION_FAILED);
        expect((error as LangChainError).originalError).toBeInstanceOf(LangChainError);
        expect((error as LangChainError).originalError?.originalError).toBe(mockError);
      }
    });
  });

  describe('utility methods', () => {
    it('should generate unique conversation IDs', () => {
      const service1 = new LangChainService();
      const service2 = new LangChainService();
      
      const id1 = service1.getState().conversationId;
      const id2 = service2.getState().conversationId;
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^conv_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^conv_\d+_[a-z0-9]+$/);
    });
  });

  describe('enhanced error handling', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should validate configuration before initialization', async () => {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { model: null },
        { model: {} },
        { model: { provider: null, modelName: null } },
        { model: { provider: ModelProvider.OPENAI, modelName: 'gpt-3.5-turbo', temperature: -1, maxTokens: 1000 } },
        { model: { provider: ModelProvider.OPENAI, modelName: 'gpt-3.5-turbo', temperature: 3, maxTokens: 1000 } },
        { model: { provider: ModelProvider.OPENAI, modelName: 'gpt-3.5-turbo', temperature: 0.7, maxTokens: -1 } }
      ];

      for (const config of invalidConfigs) {
        const newService = new LangChainService();
        await expect(newService.initialize(config as any)).rejects.toThrow(LangChainError);
      }
    });

    it('should get health status', () => {
      const health = service.getHealthStatus();
      
      expect(health.isHealthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should report unhealthy status when not initialized', () => {
      const uninitializedService = new LangChainService();
      const health = uninitializedService.getHealthStatus();
      
      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Service not initialized');
      expect(health.issues).toContain('Conversation chain not available');
      expect(health.issues).toContain('AI model not available');
      expect(health.issues).toContain('Memory not available');
    });

    it('should handle network errors in sendMessage', async () => {
      // Mock NetworkErrorHandler to simulate network error
      vi.mocked(NetworkErrorHandler.executeWithRetry).mockRejectedValueOnce(
        new NetworkError('Network failed', NetworkErrorCode.CONNECTION_FAILED)
      );

      await expect(service.sendMessage('Hello')).rejects.toThrow(LangChainError);
      await expect(service.sendMessage('Hello')).rejects.toThrow('Network error during conversation');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      vi.mocked(NetworkErrorHandler.executeWithRetry).mockRejectedValueOnce(rateLimitError);

      await expect(service.sendMessage('Hello')).rejects.toThrow(LangChainError);
      await expect(service.sendMessage('Hello')).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).status = 401;

      vi.mocked(NetworkErrorHandler.executeWithRetry).mockRejectedValueOnce(authError);

      await expect(service.sendMessage('Hello')).rejects.toThrow(LangChainError);
      await expect(service.sendMessage('Hello')).rejects.toThrow('Authentication failed');
    });

    it('should handle model unavailable errors', async () => {
      const serverError = new Error('Service unavailable');
      (serverError as any).status = 503;

      vi.mocked(NetworkErrorHandler.executeWithRetry).mockRejectedValueOnce(serverError);

      await expect(service.sendMessage('Hello')).rejects.toThrow(LangChainError);
      await expect(service.sendMessage('Hello')).rejects.toThrow('AI model is currently unavailable');
    });

    it('should handle memory errors gracefully', async () => {
      // Mock memory to throw error
      const mockMemory = {
        loadMemoryVariables: vi.fn().mockRejectedValue(new Error('Memory error'))
      };
      
      (service as any).memory = mockMemory;

      // Should still work despite memory error
      const response = await service.sendMessage('Hello');
      expect(response).toBe('Mocked chain response');
    });

    it('should reset state on initialization failure', async () => {
      const newService = new LangChainService();
      
      try {
        await newService.initialize({
          ...mockConfig,
          model: { ...mockConfig.model, provider: 'invalid' as any }
        });
      } catch (error) {
        // Service should be disposed after failure
        expect(newService.isInitialized()).toBe(false);
        expect(newService.getConfig()).toBeNull();
      }
    });
  });

  describe('Streaming functionality', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should handle streaming messages with token callbacks', async () => {
      const tokens: string[] = [];
      let completedResponse = '';
      let errorOccurred = false;

      const streamingOptions = {
        onToken: (token: string) => {
          tokens.push(token);
        },
        onComplete: (response: string) => {
          completedResponse = response;
        },
        onError: (error: Error) => {
          errorOccurred = true;
        }
      };

      const response = await service.sendMessageStreaming('Hello', streamingOptions);

      expect(response).toBe('Mocked chain response');
      expect(tokens.length).toBeGreaterThan(0);
      expect(completedResponse).toBe('Mocked chain response');
      expect(errorOccurred).toBe(false);
    });

    it('should handle streaming abort signal', async () => {
      const abortController = new AbortController();
      const streamingOptions = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
        signal: abortController.signal
      };

      // Abort immediately
      abortController.abort();

      await expect(
        service.sendMessageStreaming('Hello', streamingOptions)
      ).rejects.toThrow();

      expect(streamingOptions.onError).toHaveBeenCalled();
      expect(streamingOptions.onComplete).not.toHaveBeenCalled();
    });

    it('should handle streaming errors gracefully', async () => {
      // Mock chain to throw error
      const mockChain = {
        call: vi.fn().mockRejectedValue(new Error('Streaming failed')),
        stream: vi.fn().mockRejectedValue(new Error('Streaming failed'))
      };
      (service as any).chain = mockChain;

      let errorCaught = false;
      const streamingOptions = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: (error: Error) => {
          errorCaught = true;
          expect(error.message).toContain('Streaming failed');
        }
      };

      await expect(
        service.sendMessageStreaming('Hello', streamingOptions)
      ).rejects.toThrow();

      expect(errorCaught).toBe(true);
      expect(service.getState().isStreaming).toBe(false);
    });

    it('should update streaming state during operation', async () => {
      const streamingOptions = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const promise = service.sendMessageStreaming('Hello', streamingOptions);
      
      // Check that streaming state is set during operation
      expect(service.getState().isStreaming).toBe(true);

      await promise;

      expect(service.getState().isStreaming).toBe(false);
    });

    it('should fall back to regular call when streaming fails', async () => {
      // Mock stream to fail but call to succeed
      const mockChain = {
        call: vi.fn().mockResolvedValue({ response: 'Fallback response' }),
        stream: vi.fn().mockRejectedValue(new Error('Stream not supported'))
      };
      (service as any).chain = mockChain;

      const streamingOptions = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const response = await service.sendMessageStreaming('Hello', streamingOptions);

      expect(response).toBe('Fallback response');
      expect(mockChain.call).toHaveBeenCalled();
    });

    it('should handle simulated streaming for non-streaming models', async () => {
      // Mock a model without streaming support
      const mockChain = {
        call: vi.fn().mockResolvedValue({ response: 'Hello there friend' })
      };
      (service as any).chain = mockChain;

      const tokens: string[] = [];
      const streamingOptions = {
        onToken: (token: string) => {
          tokens.push(token);
        },
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const response = await service.sendMessageStreaming('Hello', streamingOptions);

      expect(response).toBe('Hello there friend');
      expect(tokens.length).toBeGreaterThan(1); // Should have multiple tokens from word splitting
      expect(tokens.join('')).toBe('Hello there friend');
    });
  });
});