import type { 
  LangChainConfig, 
  LangChainState, 
  Message,
  StreamingOptions
} from '../types';
import type { NetworkRequestOptions } from './NetworkErrorHandler';

/**
 * Lazy-loaded LangChain service that only initializes when AI features are needed
 */
export class LazyLangChainService {
  private langChainService: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private config: LangChainConfig | null = null;

  constructor() {
    // Don't initialize anything in constructor - wait for first use
  }

  /**
   * Lazy initialization of the actual LangChainService
   */
  private async initialize(config: LangChainConfig): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    if (this.isInitializing) {
      return this.initPromise || Promise.resolve();
    }

    this.isInitializing = true;
    this.config = config;
    
    this.initPromise = (async () => {
      try {
        // Dynamic import of LangChainService to enable code splitting
        const { LangChainService } = await import('./LangChainService');
        
        // Create the actual LangChain service
        this.langChainService = new LangChainService();
        
        // Initialize with the provided config
        await this.langChainService.initialize(config);
        
        this.isInitialized = true;
        this.isInitializing = false;
      } catch (error) {
        this.isInitializing = false;
        this.initPromise = null;
        throw new Error(`Failed to initialize LangChain service: ${error}`);
      }
    })();

    return this.initPromise;
  }

  /**
   * Initialize the service with configuration
   */
  async init(config: LangChainConfig): Promise<void> {
    return this.initialize(config);
  }

  /**
   * Get basic state without full initialization
   */
  getBasicState(): LangChainState {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        currentModel: '',
        conversationId: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tokenCount: 0,
        memorySize: 0,
        isStreaming: false
      };
    }
    
    return this.langChainService.getState();
  }

  /**
   * Send a message (initializes if needed)
   */
  async sendMessage(message: string, options?: NetworkRequestOptions): Promise<string> {
    if (!this.config) {
      throw new Error('LangChain service not configured. Call init() first.');
    }

    await this.initialize(this.config);
    return this.langChainService.sendMessage(message, options);
  }

  /**
   * Send a message with streaming (initializes if needed)
   */
  async sendMessageStreaming(
    message: string, 
    streamingOptions: StreamingOptions,
    networkOptions?: NetworkRequestOptions
  ): Promise<string> {
    if (!this.config) {
      throw new Error('LangChain service not configured. Call init() first.');
    }

    await this.initialize(this.config);
    return this.langChainService.sendMessageStreaming(message, streamingOptions, networkOptions);
  }

  /**
   * Get conversation history (initializes if needed)
   */
  async getConversationHistory(): Promise<Message[]> {
    if (!this.isInitialized) {
      return [];
    }
    
    return this.langChainService.getConversationHistory();
  }

  /**
   * Update model configuration (requires initialization)
   */
  async updateModelConfig(modelConfig: LangChainConfig['model']): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('LangChain service not initialized');
    }
    
    return this.langChainService.updateModelConfig(modelConfig);
  }

  /**
   * Clear conversation memory (requires initialization)
   */
  async clearMemory(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    return this.langChainService.clearMemory();
  }

  /**
   * Get current state (returns basic state if not initialized)
   */
  getState(): LangChainState {
    if (!this.isInitialized) {
      return this.getBasicState();
    }
    
    return this.langChainService.getState();
  }

  /**
   * Check if the service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if the service is currently initializing
   */
  isLoading(): boolean {
    return this.isInitializing;
  }

  /**
   * Get current configuration
   */
  getConfig(): LangChainConfig | null {
    if (!this.isInitialized) {
      return this.config;
    }
    
    return this.langChainService.getConfig();
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    issues: string[];
    lastError?: string;
  } {
    if (!this.isInitialized) {
      return {
        isHealthy: false,
        issues: ['Service not initialized'],
        lastError: undefined
      };
    }
    
    return this.langChainService.getHealthStatus();
  }

  /**
   * Preload the LangChain service without using it
   * Useful for warming up the module in the background
   */
  async preload(config: LangChainConfig): Promise<void> {
    if (!this.isInitialized && !this.isInitializing) {
      // Start initialization but don't wait for it
      this.initialize(config).catch(error => {
        console.warn('LangChain service preload failed:', error);
      });
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.isInitialized && this.langChainService) {
      this.langChainService.dispose();
    }
    
    this.langChainService = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.initPromise = null;
    this.config = null;
  }
}

/**
 * Factory function for creating lazy LangChain service instances
 */
export function createLazyLangChainService(): LazyLangChainService {
  return new LazyLangChainService();
}

/**
 * Hook for using lazy LangChain service with React
 */
// Note: React hooks would be imported from 'react' in actual usage
// This is just a placeholder for the hook pattern