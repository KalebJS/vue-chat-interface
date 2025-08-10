import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ConversationChain } from 'langchain/chains';
import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory';
import { BaseMemory } from 'langchain/memory';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { 
  LangChainConfig, 
  LangChainState, 
  Message,
  StreamingOptions
} from '../types';
import {
  ModelProvider, 
  MemoryType, 
  ChainType,
  LangChainError,
  LangChainErrorCode,
  MessageStatus,
  NetworkError,
  NetworkErrorCode
} from '../types';
import { NetworkErrorHandler, type NetworkRequestOptions } from './NetworkErrorHandler';

export class LangChainService {
  private chain: ConversationChain | null = null;
  private memory: BaseMemory | null = null;
  private model: BaseChatModel | null = null;
  private config: LangChainConfig | null = null;
  private state: LangChainState;

  constructor() {
    this.state = {
      isInitialized: false,
      currentModel: '',
      conversationId: this.generateConversationId(),
      tokenCount: 0,
      memorySize: 0,
      isStreaming: false
    };
  }

  /**
   * Initialize the LangChain service with the provided configuration
   */
  async initialize(config: LangChainConfig): Promise<void> {
    try {
      // Validate configuration first
      this.validateConfig(config);
      
      this.config = config;
      
      // Initialize the model
      this.model = await this.createModel(config.model);
      
      // Initialize memory
      this.memory = await this.createMemory(config.memory);
      
      // Create conversation chain
      this.chain = new ConversationChain({
        llm: this.model,
        memory: this.memory,
        verbose: config.chain.verbose || false
      });

      // Update state
      this.state = {
        ...this.state,
        isInitialized: true,
        currentModel: `${config.model.provider}:${config.model.modelName}`
      };

    } catch (error) {
      // Reset state on initialization failure
      this.dispose();
      
      if (error instanceof LangChainError) {
        throw error;
      }
      
      throw new LangChainError(
        'Failed to initialize LangChain service',
        LangChainErrorCode.INITIALIZATION_FAILED,
        error as Error
      );
    }
  }

  /**
   * Create a model instance based on the provider configuration
   */
  private async createModel(modelConfig: LangChainConfig['model']): Promise<BaseChatModel> {
    try {
      switch (modelConfig.provider) {
        case ModelProvider.OPENAI:
          return new ChatOpenAI({
            modelName: modelConfig.modelName,
            temperature: modelConfig.temperature,
            maxTokens: modelConfig.maxTokens,
            openAIApiKey: process.env.OPENAI_API_KEY
          });

        case ModelProvider.ANTHROPIC:
          return new ChatAnthropic({
            modelName: modelConfig.modelName,
            temperature: modelConfig.temperature,
            maxTokens: modelConfig.maxTokens,
            anthropicApiKey: process.env.ANTHROPIC_API_KEY
          });

        case ModelProvider.LOCAL:
          // For local models, we would need to implement a custom chat model
          // For now, throw an error indicating it's not implemented
          throw new LangChainError(
            'Local model provider not yet implemented',
            LangChainErrorCode.MODEL_NOT_AVAILABLE
          );

        default:
          throw new LangChainError(
            `Unsupported model provider: ${modelConfig.provider}`,
            LangChainErrorCode.CONFIGURATION_ERROR
          );
      }
    } catch (error) {
      if (error instanceof LangChainError) {
        throw error;
      }
      throw new LangChainError(
        'Failed to create model instance',
        LangChainErrorCode.MODEL_NOT_AVAILABLE,
        error as Error
      );
    }
  }

  /**
   * Create a memory instance based on the memory configuration
   */
  private async createMemory(memoryConfig: LangChainConfig['memory']): Promise<BaseMemory> {
    try {
      switch (memoryConfig.type) {
        case MemoryType.BUFFER:
          return new BufferMemory({
            returnMessages: memoryConfig.returnMessages || true,
            memoryKey: 'history'
          });

        case MemoryType.SUMMARY:
          if (!this.model) {
            throw new LangChainError(
              'Model must be initialized before creating summary memory',
              LangChainErrorCode.CONFIGURATION_ERROR
            );
          }
          return new ConversationSummaryMemory({
            llm: this.model,
            returnMessages: memoryConfig.returnMessages || true,
            memoryKey: 'history'
          });

        case MemoryType.VECTOR:
          // Vector memory would require additional setup with embeddings
          // For now, throw an error indicating it's not implemented
          throw new LangChainError(
            'Vector memory type not yet implemented',
            LangChainErrorCode.CONFIGURATION_ERROR
          );

        default:
          throw new LangChainError(
            `Unsupported memory type: ${memoryConfig.type}`,
            LangChainErrorCode.CONFIGURATION_ERROR
          );
      }
    } catch (error) {
      if (error instanceof LangChainError) {
        throw error;
      }
      throw new LangChainError(
        'Failed to create memory instance',
        LangChainErrorCode.MEMORY_ERROR,
        error as Error
      );
    }
  }

  /**
   * Send a message through the conversation chain with streaming support
   */
  async sendMessage(message: string, options?: NetworkRequestOptions): Promise<string> {
    if (!this.isInitialized()) {
      throw new LangChainError(
        'LangChain service not initialized',
        LangChainErrorCode.INITIALIZATION_FAILED
      );
    }

    try {
      // Use network error handler for retry logic
      const response = await NetworkErrorHandler.executeWithRetry(
        async () => {
          if (!this.chain) {
            throw new LangChainError(
              'Conversation chain not available',
              LangChainErrorCode.INITIALIZATION_FAILED
            );
          }

          try {
            return await this.chain.call({ input: message });
          } catch (error) {
            // Convert LangChain errors to appropriate error types
            if (this.isNetworkError(error)) {
              throw new NetworkError(
                'AI model request failed',
                NetworkErrorCode.CONNECTION_FAILED,
                undefined,
                error as Error
              );
            }
            throw error;
          }
        },
        {
          timeout: options?.timeout || 30000, // 30 second default timeout
          retryConfig: {
            maxRetries: 2,
            baseDelay: 2000,
            ...options?.retryConfig
          },
          signal: options?.signal
        }
      );
      
      // Update token count (approximate)
      this.state.tokenCount += this.estimateTokenCount(message + response.response);
      
      // Update memory size
      if (this.memory) {
        try {
          const memoryVariables = await this.memory.loadMemoryVariables({});
          this.state.memorySize = JSON.stringify(memoryVariables).length;
        } catch (memoryError) {
          console.warn('Failed to update memory size:', memoryError);
          // Don't fail the entire request for memory size calculation
        }
      }

      return response.response;
    } catch (error) {
      // Enhanced error handling with specific error types
      if (error instanceof NetworkError) {
        throw new LangChainError(
          `Network error during conversation: ${error.message}`,
          LangChainErrorCode.CONVERSATION_FAILED,
          error
        );
      }

      if (error instanceof LangChainError) {
        throw error;
      }

      // Handle specific API errors
      if (this.isRateLimitError(error)) {
        throw new LangChainError(
          'Rate limit exceeded. Please wait before sending another message.',
          LangChainErrorCode.CONVERSATION_FAILED,
          error as Error
        );
      }

      if (this.isAuthenticationError(error)) {
        throw new LangChainError(
          'Authentication failed. Please check your API credentials.',
          LangChainErrorCode.MODEL_NOT_AVAILABLE,
          error as Error
        );
      }

      if (this.isModelUnavailableError(error)) {
        throw new LangChainError(
          'AI model is currently unavailable. Please try again later.',
          LangChainErrorCode.MODEL_NOT_AVAILABLE,
          error as Error
        );
      }

      throw new LangChainError(
        'Failed to send message',
        LangChainErrorCode.CONVERSATION_FAILED,
        error as Error
      );
    }
  }

  /**
   * Send a message with streaming response support
   */
  async sendMessageStreaming(
    message: string, 
    streamingOptions: StreamingOptions,
    networkOptions?: NetworkRequestOptions
  ): Promise<string> {
    if (!this.isInitialized()) {
      throw new LangChainError(
        'LangChain service not initialized',
        LangChainErrorCode.INITIALIZATION_FAILED
      );
    }

    if (!this.chain) {
      throw new LangChainError(
        'Conversation chain not available',
        LangChainErrorCode.INITIALIZATION_FAILED
      );
    }

    // Set streaming state
    this.state.isStreaming = true;
    
    let fullResponse = '';
    let aborted = false;

    try {
      // Check if the signal is already aborted
      if (streamingOptions.signal?.aborted) {
        throw new Error('Request was aborted before starting');
      }

      // Set up abort handling
      const abortHandler = () => {
        aborted = true;
        this.state.isStreaming = false;
      };
      
      streamingOptions.signal?.addEventListener('abort', abortHandler);

      // Use network error handler for retry logic with streaming
      const response = await NetworkErrorHandler.executeWithRetry(
        async () => {
          if (aborted) {
            throw new Error('Request was aborted');
          }

          // For streaming, we need to handle the response differently
          // LangChain's streaming support varies by model provider
          if (this.model && 'stream' in this.model && typeof this.model.stream === 'function') {
            // Use native streaming if available
            return await this.handleNativeStreaming(message, streamingOptions);
          } else {
            // Fallback to simulated streaming for models that don't support it
            return await this.handleSimulatedStreaming(message, streamingOptions);
          }
        },
        {
          timeout: networkOptions?.timeout || 60000, // Longer timeout for streaming
          retryConfig: {
            maxRetries: 1, // Fewer retries for streaming to avoid confusion
            baseDelay: 2000,
            ...networkOptions?.retryConfig
          },
          signal: streamingOptions.signal
        }
      );

      fullResponse = response;

      // Update token count (approximate)
      this.state.tokenCount += this.estimateTokenCount(message + fullResponse);
      
      // Update memory size
      if (this.memory) {
        try {
          const memoryVariables = await this.memory.loadMemoryVariables({});
          this.state.memorySize = JSON.stringify(memoryVariables).length;
        } catch (memoryError) {
          console.warn('Failed to update memory size:', memoryError);
        }
      }

      // Call completion callback
      if (streamingOptions.onComplete && !aborted) {
        streamingOptions.onComplete(fullResponse);
      }

      return fullResponse;

    } catch (error) {
      // Call error callback
      if (streamingOptions.onError && !aborted) {
        streamingOptions.onError(error as Error);
      }

      // Enhanced error handling
      if (error instanceof NetworkError) {
        throw new LangChainError(
          `Network error during streaming conversation: ${error.message}`,
          LangChainErrorCode.STREAMING_ERROR,
          error
        );
      }

      if (error instanceof LangChainError) {
        throw error;
      }

      // Handle specific streaming errors
      if (this.isStreamingError(error)) {
        throw new LangChainError(
          'Streaming response was interrupted or failed',
          LangChainErrorCode.STREAMING_ERROR,
          error as Error
        );
      }

      if (this.isRateLimitError(error)) {
        throw new LangChainError(
          'Rate limit exceeded during streaming. Please wait before sending another message.',
          LangChainErrorCode.CONVERSATION_FAILED,
          error as Error
        );
      }

      if (this.isAuthenticationError(error)) {
        throw new LangChainError(
          'Authentication failed during streaming. Please check your API credentials.',
          LangChainErrorCode.MODEL_NOT_AVAILABLE,
          error as Error
        );
      }

      throw new LangChainError(
        'Failed to send streaming message',
        LangChainErrorCode.STREAMING_ERROR,
        error as Error
      );
    } finally {
      // Always reset streaming state
      this.state.isStreaming = false;
      
      // Clean up abort listener
      if (streamingOptions.signal) {
        streamingOptions.signal.removeEventListener('abort', () => {});
      }
    }
  }

  /**
   * Handle native streaming for models that support it
   */
  private async handleNativeStreaming(
    message: string, 
    streamingOptions: StreamingOptions
  ): Promise<string> {
    if (!this.chain) {
      throw new Error('Conversation chain not available');
    }

    let fullResponse = '';

    try {
      // For models that support streaming, we need to use the streaming interface
      // This is a simplified implementation - actual streaming would depend on the specific model
      const stream = await this.chain.stream({ input: message });
      
      for await (const chunk of stream) {
        if (streamingOptions.signal?.aborted) {
          break;
        }

        // Extract text from chunk (format varies by model)
        const token = this.extractTokenFromChunk(chunk);
        if (token) {
          fullResponse += token;
          
          // Call token callback
          if (streamingOptions.onToken) {
            streamingOptions.onToken(token);
          }
        }
      }

      return fullResponse;
    } catch (error) {
      // If streaming fails, fall back to regular call
      console.warn('Native streaming failed, falling back to regular call:', error);
      const response = await this.chain.call({ input: message });
      return response.response;
    }
  }

  /**
   * Handle simulated streaming for models that don't support native streaming
   */
  private async handleSimulatedStreaming(
    message: string, 
    streamingOptions: StreamingOptions
  ): Promise<string> {
    if (!this.chain) {
      throw new Error('Conversation chain not available');
    }

    // Get the full response first
    const response = await this.chain.call({ input: message });
    const fullText = response.response;

    // Simulate streaming by sending tokens progressively
    const words = fullText.split(' ');
    let currentText = '';

    for (let i = 0; i < words.length; i++) {
      if (streamingOptions.signal?.aborted) {
        break;
      }

      const word = words[i];
      const token = i === 0 ? word : ' ' + word;
      currentText += token;

      // Call token callback
      if (streamingOptions.onToken) {
        streamingOptions.onToken(token);
      }

      // Add a small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return fullText;
  }

  /**
   * Extract token from streaming chunk (format varies by model)
   */
  private extractTokenFromChunk(chunk: any): string {
    // This is a simplified implementation
    // Actual token extraction would depend on the specific model's chunk format
    if (typeof chunk === 'string') {
      return chunk;
    }
    
    if (chunk && typeof chunk === 'object') {
      // Try common chunk formats
      if (chunk.text) return chunk.text;
      if (chunk.content) return chunk.content;
      if (chunk.token) return chunk.token;
      if (chunk.response) return chunk.response;
    }
    
    return '';
  }

  /**
   * Check if an error is a streaming-specific error
   */
  private isStreamingError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    
    return (
      errorMessage.includes('stream') ||
      errorMessage.includes('streaming') ||
      errorMessage.includes('connection interrupted') ||
      errorMessage.includes('connection closed') ||
      errorMessage.includes('aborted') ||
      error.name === 'AbortError'
    );
  }

  /**
   * Get the current conversation history from memory
   */
  async getConversationHistory(): Promise<Message[]> {
    if (!this.memory) {
      return [];
    }

    try {
      const memoryVariables = await this.memory.loadMemoryVariables({});
      const history = memoryVariables.history;
      
      // Convert LangChain memory format to our Message format
      // This is a simplified conversion - actual implementation may vary based on memory type
      if (Array.isArray(history)) {
        return history.map((msg: any, index: number) => ({
          id: `history-${index}`,
          text: msg.content || msg.text || String(msg),
          sender: msg.type === 'human' ? 'user' as const : 'ai' as const,
          timestamp: new Date(),
          status: MessageStatus.SENT
        }));
      }

      return [];
    } catch (error) {
      throw new LangChainError(
        'Failed to retrieve conversation history',
        LangChainErrorCode.MEMORY_ERROR,
        error as Error
      );
    }
  }

  /**
   * Update the model configuration
   */
  async updateModelConfig(modelConfig: LangChainConfig['model']): Promise<void> {
    if (!this.config) {
      throw new LangChainError(
        'Service not initialized',
        LangChainErrorCode.INITIALIZATION_FAILED
      );
    }

    try {
      // Create new model with updated config
      const newModel = await this.createModel(modelConfig);
      
      // Update the chain with new model
      if (this.chain) {
        this.chain.llm = newModel;
      }
      
      // Update config and state
      this.config.model = modelConfig;
      this.model = newModel;
      this.state.currentModel = `${modelConfig.provider}:${modelConfig.modelName}`;
      
    } catch (error) {
      throw new LangChainError(
        'Failed to update model configuration',
        LangChainErrorCode.CONFIGURATION_ERROR,
        error as Error
      );
    }
  }

  /**
   * Clear conversation memory
   */
  async clearMemory(): Promise<void> {
    if (!this.memory) {
      return;
    }

    try {
      // Clear memory if it has a clear method
      if ('clear' in this.memory && typeof this.memory.clear === 'function') {
        await this.memory.clear();
      } else {
        // For memories without clear method, recreate the memory
        if (this.config) {
          this.memory = await this.createMemory(this.config.memory);
          if (this.chain) {
            this.chain.memory = this.memory;
          }
        }
      }
      this.state.memorySize = 0;
      this.state.tokenCount = 0;
    } catch (error) {
      throw new LangChainError(
        'Failed to clear memory',
        LangChainErrorCode.MEMORY_ERROR,
        error as Error
      );
    }
  }

  /**
   * Get current service state
   */
  getState(): LangChainState {
    return { ...this.state };
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.state.isInitialized && this.chain !== null;
  }

  /**
   * Get current configuration
   */
  getConfig(): LangChainConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate token count for a given text (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if an error is a network-related error
   */
  private isNetworkError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';
    
    return (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch') ||
      errorCode.includes('network') ||
      errorCode.includes('timeout') ||
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError'
    );
  }

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.status || error.statusCode;
    
    return (
      statusCode === 429 ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('quota exceeded')
    );
  }

  /**
   * Check if an error is an authentication error
   */
  private isAuthenticationError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.status || error.statusCode;
    
    return (
      statusCode === 401 ||
      statusCode === 403 ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('api key') ||
      errorMessage.includes('invalid credentials')
    );
  }

  /**
   * Check if an error indicates model unavailability
   */
  private isModelUnavailableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.status || error.statusCode;
    
    return (
      statusCode === 503 ||
      statusCode === 502 ||
      statusCode === 500 ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('model not available') ||
      errorMessage.includes('server error') ||
      errorMessage.includes('internal error')
    );
  }

  /**
   * Validate configuration before initialization
   */
  private validateConfig(config: LangChainConfig): void {
    if (!config) {
      throw new LangChainError(
        'Configuration is required',
        LangChainErrorCode.CONFIGURATION_ERROR
      );
    }

    if (!config.model) {
      throw new LangChainError(
        'Model configuration is required',
        LangChainErrorCode.CONFIGURATION_ERROR
      );
    }

    if (!config.model.provider || !config.model.modelName) {
      throw new LangChainError(
        'Model provider and name are required',
        LangChainErrorCode.CONFIGURATION_ERROR
      );
    }

    if (config.model.temperature < 0 || config.model.temperature > 2) {
      throw new LangChainError(
        'Temperature must be between 0 and 2',
        LangChainErrorCode.CONFIGURATION_ERROR
      );
    }

    if (config.model.maxTokens <= 0) {
      throw new LangChainError(
        'Max tokens must be greater than 0',
        LangChainErrorCode.CONFIGURATION_ERROR
      );
    }
  }

  /**
   * Get health status of the service
   */
  getHealthStatus(): {
    isHealthy: boolean;
    issues: string[];
    lastError?: string;
  } {
    const issues: string[] = [];
    
    if (!this.state.isInitialized) {
      issues.push('Service not initialized');
    }
    
    if (!this.chain) {
      issues.push('Conversation chain not available');
    }
    
    if (!this.model) {
      issues.push('AI model not available');
    }
    
    if (!this.memory) {
      issues.push('Memory not available');
    }

    if (!NetworkErrorHandler.isOnline()) {
      issues.push('Network connection unavailable');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      lastError: undefined // Could be enhanced to track last error
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.chain = null;
    this.memory = null;
    this.model = null;
    this.config = null;
    this.state = {
      isInitialized: false,
      currentModel: '',
      conversationId: this.generateConversationId(),
      tokenCount: 0,
      memorySize: 0,
      isStreaming: false
    };
  }
}