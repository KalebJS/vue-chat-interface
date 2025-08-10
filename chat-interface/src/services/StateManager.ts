import type { 
  AppState, 
  Message, 
  AudioState, 
  LangChainState, 
  AppSettings,
  LangChainConfig,
  StreamingOptions
} from '../types';
import {
  ModelProvider,
  MemoryType,
  ChainType,
  MessageStatus
} from '../types';
import { LangChainService } from './LangChainService';

export type StateUpdateCallback = (state: AppState) => void;

export class StateManager {
  private state: AppState;
  private callbacks: Set<StateUpdateCallback> = new Set();
  private langChainService: LangChainService;
  private storageKey = 'chat-interface-state';

  constructor(langChainService: LangChainService) {
    this.langChainService = langChainService;
    this.state = this.getInitialState();
    this.loadPersistedState();
  }

  /**
   * Get the initial default state
   */
  private getInitialState(): AppState {
    return {
      messages: [],
      currentInput: '',
      isLoading: false,
      audioState: {
        isRecording: false,
        isPlaying: false,
        isSupported: false,
        hasPermission: false,
        error: undefined
      },
      langChainState: {
        isInitialized: false,
        currentModel: '',
        conversationId: '',
        tokenCount: 0,
        memorySize: 0,
        isStreaming: false
      },
      error: undefined,
      settings: {
        autoScroll: true,
        audioEnabled: true,
        voiceSettings: {
          rate: 1.0,
          pitch: 1.0,
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
  }

  /**
   * Get current application state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Update application state with partial updates
   */
  setState(updates: Partial<AppState>): void {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Sync with LangChain if needed
    this.syncWithLangChain(previousState);
    
    // Persist state changes
    this.persistState();
    
    // Notify subscribers
    this.notifyCallbacks();
  }

  /**
   * Update specific parts of the state
   */
  updateMessages(messages: Message[]): void {
    this.setState({ messages });
  }

  updateCurrentInput(currentInput: string): void {
    this.setState({ currentInput });
  }

  updateLoadingState(isLoading: boolean): void {
    this.setState({ isLoading });
  }

  updateAudioState(audioState: Partial<AudioState>): void {
    this.setState({ 
      audioState: { ...this.state.audioState, ...audioState }
    });
  }

  updateLangChainState(langChainState: Partial<LangChainState>): void {
    this.setState({ 
      langChainState: { ...this.state.langChainState, ...langChainState }
    });
  }

  updateSettings(settings: Partial<AppSettings>): void {
    this.setState({ 
      settings: { ...this.state.settings, ...settings }
    });
  }

  updateError(error: string | undefined): void {
    this.setState({ error });
  }

  /**
   * Add a new message to the conversation
   */
  addMessage(message: Omit<Message, 'id' | 'timestamp'>): void {
    const newMessage: Message = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date()
    };
    
    this.setState({ 
      messages: [...this.state.messages, newMessage]
    });
  }

  /**
   * Update an existing message
   */
  updateMessage(messageId: string, updates: Partial<Message>): void {
    const updatedMessages = this.state.messages.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    );
    
    this.setState({ messages: updatedMessages });
  }

  /**
   * Start streaming for a message
   */
  startMessageStreaming(messageId: string): void {
    this.updateMessage(messageId, { 
      isStreaming: true, 
      streamingComplete: false 
    });
    this.updateLangChainState({ 
      isStreaming: true, 
      streamingMessageId: messageId 
    });
  }

  /**
   * Update streaming message with new token
   */
  updateStreamingMessage(messageId: string, token: string): void {
    const message = this.state.messages.find(msg => msg.id === messageId);
    if (message && message.isStreaming) {
      this.updateMessage(messageId, { 
        text: message.text + token 
      });
    }
  }

  /**
   * Complete streaming for a message
   */
  completeMessageStreaming(messageId: string, finalText?: string): void {
    const updates: Partial<Message> = {
      isStreaming: false,
      streamingComplete: true,
      status: MessageStatus.SENT
    };
    
    if (finalText !== undefined) {
      updates.text = finalText;
    }
    
    this.updateMessage(messageId, updates);
    this.updateLangChainState({ 
      isStreaming: false, 
      streamingMessageId: undefined 
    });
  }

  /**
   * Handle streaming error
   */
  handleStreamingError(messageId: string, error: string): void {
    this.updateMessage(messageId, { 
      isStreaming: false,
      streamingComplete: false,
      status: MessageStatus.ERROR 
    });
    this.updateLangChainState({ 
      isStreaming: false, 
      streamingMessageId: undefined 
    });
    this.updateError(error);
  }

  /**
   * Send a message with streaming support
   */
  async sendMessageWithStreaming(
    messageText: string, 
    enableStreaming: boolean = true,
    abortSignal?: AbortSignal
  ): Promise<void> {
    // Add user message
    const userMessage: Message = {
      id: this.generateMessageId(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
      status: MessageStatus.SENT
    };
    
    this.setState({ 
      messages: [...this.state.messages, userMessage],
      isLoading: true,
      currentInput: '',
      error: undefined
    });

    // Create AI message placeholder
    const aiMessageId = this.generateMessageId();
    const aiMessage: Message = {
      id: aiMessageId,
      text: '',
      sender: 'ai',
      timestamp: new Date(),
      status: MessageStatus.SENDING,
      isStreaming: enableStreaming,
      streamingComplete: false
    };
    
    this.setState({ 
      messages: [...this.state.messages, aiMessage]
    });

    try {
      if (enableStreaming && this.langChainService.isInitialized()) {
        // Start streaming
        this.startMessageStreaming(aiMessageId);

        const streamingOptions: StreamingOptions = {
          onToken: (token: string) => {
            this.updateStreamingMessage(aiMessageId, token);
          },
          onComplete: (fullResponse: string) => {
            this.completeMessageStreaming(aiMessageId, fullResponse);
          },
          onError: (error: Error) => {
            this.handleStreamingError(aiMessageId, error.message);
          },
          signal: abortSignal
        };

        await this.langChainService.sendMessageStreaming(
          messageText, 
          streamingOptions
        );
      } else {
        // Fallback to regular message sending
        const response = await this.langChainService.sendMessage(messageText);
        this.updateMessage(aiMessageId, {
          text: response,
          status: MessageStatus.SENT
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      this.handleStreamingError(aiMessageId, errorMessage);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.setState({ messages: [] });
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateUpdateCallback): () => void {
    this.callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state update callback:', error);
      }
    });
  }

  /**
   * Synchronize state with LangChain service
   */
  private syncWithLangChain(previousState: AppState): void {
    // Update LangChain state from service
    if (this.langChainService.isInitialized()) {
      const langChainState = this.langChainService.getState();
      if (JSON.stringify(langChainState) !== JSON.stringify(this.state.langChainState)) {
        this.state.langChainState = langChainState;
      }
    }

    // If AI model settings changed, update LangChain service
    const modelConfigChanged = JSON.stringify(previousState.settings.aiModel.model) !== 
                              JSON.stringify(this.state.settings.aiModel.model);
    
    if (modelConfigChanged && this.langChainService.isInitialized()) {
      this.langChainService.updateModelConfig(this.state.settings.aiModel.model)
        .catch(error => {
          console.error('Failed to update LangChain model config:', error);
          this.setState({ error: 'Failed to update AI model configuration' });
        });
    }
  }

  /**
   * Load conversation history from both localStorage and LangChain service
   */
  async loadConversationHistory(): Promise<void> {
    try {
      // First, load from localStorage (already done in constructor)
      let messages = [...this.state.messages];

      // Then, if LangChain is initialized, merge with LangChain history
      if (this.langChainService.isInitialized()) {
        const langChainHistory = await this.langChainService.getConversationHistory();
        
        // Merge histories, avoiding duplicates based on message content and timestamp
        const mergedMessages = this.mergeMessageHistories(messages, langChainHistory);
        messages = mergedMessages;
      }

      this.setState({ messages });
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      this.setState({ error: 'Failed to load conversation history' });
    }
  }

  /**
   * Load more conversation history (for infinite scroll)
   */
  async loadMoreHistory(_beforeMessageId?: string): Promise<Message[]> {
    if (!this.langChainService.isInitialized()) {
      return [];
    }

    try {
      // In a real implementation, this would load older messages
      // For now, we'll return empty array as this would require
      // pagination support in the LangChain service
      return [];
    } catch (error) {
      console.error('Failed to load more history:', error);
      this.setState({ error: 'Failed to load more conversation history' });
      return [];
    }
  }

  /**
   * Merge message histories from different sources, avoiding duplicates
   */
  private mergeMessageHistories(localMessages: Message[], langChainMessages: Message[]): Message[] {
    const messageMap = new Map<string, Message>();
    
    // Add local messages first
    localMessages.forEach(msg => {
      const key = `${msg.text}-${msg.sender}-${msg.timestamp.getTime()}`;
      messageMap.set(key, msg);
    });
    
    // Add LangChain messages, avoiding duplicates
    langChainMessages.forEach(msg => {
      const key = `${msg.text}-${msg.sender}-${msg.timestamp.getTime()}`;
      if (!messageMap.has(key)) {
        messageMap.set(key, msg);
      }
    });
    
    // Sort by timestamp
    return Array.from(messageMap.values()).sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * Persist state to localStorage
   */
  private persistState(): void {
    try {
      const persistableState = {
        messages: this.state.messages,
        settings: this.state.settings,
        // Don't persist temporary states like isLoading, currentInput, etc.
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(persistableState));
    } catch (error) {
      console.error('Failed to persist state to localStorage:', error);
    }
  }

  /**
   * Load persisted state from localStorage
   */
  private loadPersistedState(): void {
    try {
      const persistedData = localStorage.getItem(this.storageKey);
      if (persistedData) {
        const parsed = JSON.parse(persistedData);
        
        // Validate and merge persisted state
        if (parsed.messages && Array.isArray(parsed.messages)) {
          this.state.messages = parsed.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp) // Convert timestamp back to Date
          }));
        }
        
        if (parsed.settings) {
          this.state.settings = { ...this.state.settings, ...parsed.settings };
        }
      }
    } catch (error) {
      console.error('Failed to load persisted state from localStorage:', error);
      // Continue with default state if loading fails
    }
  }

  /**
   * Clear persisted state from localStorage
   */
  clearPersistedState(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear persisted state:', error);
    }
  }

  /**
   * Reset state to initial values
   */
  resetState(): void {
    this.state = this.getInitialState();
    this.clearPersistedState();
    this.notifyCallbacks();
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get state for debugging purposes
   */
  getDebugInfo(): object {
    return {
      stateSize: JSON.stringify(this.state).length,
      messageCount: this.state.messages.length,
      subscriberCount: this.callbacks.size,
      langChainInitialized: this.langChainService.isInitialized(),
      persistedStateExists: !!localStorage.getItem(this.storageKey)
    };
  }

  /**
   * Dispose of resources and cleanup
   */
  dispose(): void {
    this.callbacks.clear();
    this.persistState(); // Final persist before cleanup
  }
}