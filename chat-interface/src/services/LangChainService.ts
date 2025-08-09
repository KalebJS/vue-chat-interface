import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ConversationChain } from 'langchain/chains';
import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory';
import { BaseMemory } from 'langchain/memory';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { 
  LangChainConfig, 
  LangChainState, 
  Message
} from '../types';
import {
  ModelProvider, 
  MemoryType, 
  ChainType,
  LangChainError,
  LangChainErrorCode,
  MessageStatus
} from '../types';

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
   * Send a message through the conversation chain
   */
  async sendMessage(message: string): Promise<string> {
    if (!this.isInitialized()) {
      throw new LangChainError(
        'LangChain service not initialized',
        LangChainErrorCode.INITIALIZATION_FAILED
      );
    }

    try {
      const response = await this.chain!.call({ input: message });
      
      // Update token count (approximate)
      this.state.tokenCount += this.estimateTokenCount(message + response.response);
      
      // Update memory size
      if (this.memory) {
        const memoryVariables = await this.memory.loadMemoryVariables({});
        this.state.memorySize = JSON.stringify(memoryVariables).length;
      }

      return response.response;
    } catch (error) {
      throw new LangChainError(
        'Failed to send message',
        LangChainErrorCode.CONVERSATION_FAILED,
        error as Error
      );
    }
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