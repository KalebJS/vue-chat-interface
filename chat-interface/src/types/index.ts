// Core type definitions for the chat interface application

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  audioUrl?: string;
  status: MessageStatus;
  isStreaming?: boolean;
  streamingComplete?: boolean;
}

export interface AudioState {
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  isSupported: boolean;
  hasPermission: boolean;
  error?: string;
}

export interface LangChainState {
  isInitialized: boolean;
  currentModel: string;
  conversationId: string;
  tokenCount: number;
  memorySize: number;
  isStreaming: boolean;
  streamingMessageId?: string;
}

export interface AppState {
  messages: Message[];
  currentInput: string;
  isLoading: boolean;
  audioState: AudioState;
  langChainState: LangChainState;
  error?: string;
  settings: AppSettings;
}

export interface AppSettings {
  autoScroll: boolean;
  audioEnabled: boolean;
  voiceSettings: VoiceSettings;
  aiModel: LangChainConfig;
}

export interface VoiceSettings {
  rate: number;
  pitch: number;
  voice?: string;
}

export interface LangChainConfig {
  model: ModelConfig;
  memory: MemoryConfig;
  chain: ChainConfig;
}

export interface ModelConfig {
  provider: ModelProvider;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export interface MemoryConfig {
  type: MemoryType;
  maxTokenLimit?: number;
  returnMessages?: boolean;
}

export interface ChainConfig {
  type: ChainType;
  verbose?: boolean;
  streaming?: boolean;
}

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

// Enums and Status Types
export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  ERROR = 'error'
}

export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  LOCAL = 'local'
}

export enum MemoryType {
  BUFFER = 'buffer',
  SUMMARY = 'summary',
  VECTOR = 'vector'
}

export enum ChainType {
  CONVERSATION = 'conversation',
  RETRIEVAL_QA = 'retrieval_qa'
}

// Error Types
export class AudioError extends Error {
  constructor(
    message: string,
    public code: AudioErrorCode,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AudioError';
  }
}

export class LangChainError extends Error {
  constructor(
    message: string,
    public code: LangChainErrorCode,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'LangChainError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public code: NetworkErrorCode,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export enum AudioErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  RECORDING_FAILED = 'RECORDING_FAILED',
  PLAYBACK_FAILED = 'PLAYBACK_FAILED',
  SPEECH_RECOGNITION_FAILED = 'SPEECH_RECOGNITION_FAILED',
  TEXT_TO_SPEECH_FAILED = 'TEXT_TO_SPEECH_FAILED'
}

export enum LangChainErrorCode {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  MODEL_NOT_AVAILABLE = 'MODEL_NOT_AVAILABLE',
  CONVERSATION_FAILED = 'CONVERSATION_FAILED',
  MEMORY_ERROR = 'MEMORY_ERROR',
  STREAMING_ERROR = 'STREAMING_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

export enum NetworkErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

// Type Guards
export const isMessage = (obj: any): obj is Message => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.text === 'string' &&
    (obj.sender === 'user' || obj.sender === 'ai') &&
    obj.timestamp instanceof Date &&
    Object.values(MessageStatus).includes(obj.status)
  );
};

export const isAudioState = (obj: any): obj is AudioState => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.isRecording === 'boolean' &&
    typeof obj.isPlaying === 'boolean' &&
    typeof obj.isPaused === 'boolean' &&
    typeof obj.isSupported === 'boolean' &&
    typeof obj.hasPermission === 'boolean'
  );
};

export const isLangChainState = (obj: any): obj is LangChainState => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.isInitialized === 'boolean' &&
    typeof obj.currentModel === 'string' &&
    typeof obj.conversationId === 'string' &&
    typeof obj.tokenCount === 'number' &&
    typeof obj.memorySize === 'number' &&
    typeof obj.isStreaming === 'boolean'
  );
};