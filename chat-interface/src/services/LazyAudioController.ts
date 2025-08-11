import type { AudioState, VoiceSettings } from '../types';

/**
 * Lazy-loaded audio controller that only initializes when audio features are needed
 */
export class LazyAudioController {
  private audioController: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private stateChangeCallback?: (state: AudioState) => void;
  private transcriptionCallback?: (text: string) => void;

  constructor() {
    // Don't initialize anything in constructor - wait for first use
  }

  /**
   * Lazy initialization of the actual AudioController
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return this.initPromise || Promise.resolve();
    }

    this.isInitializing = true;
    
    this.initPromise = (async () => {
      try {
        // Dynamic import of AudioController to enable code splitting
        const { AudioController } = await import('./AudioController');
        
        // Create the actual audio controller
        this.audioController = new AudioController();
        
        // Set up callbacks if they were registered before initialization
        if (this.stateChangeCallback) {
          this.audioController.setStateChangeCallback(this.stateChangeCallback);
        }
        
        if (this.transcriptionCallback) {
          this.audioController.setTranscriptionCallback(this.transcriptionCallback);
        }
        
        this.isInitialized = true;
        this.isInitializing = false;
      } catch (error) {
        this.isInitializing = false;
        throw new Error(`Failed to initialize audio controller: ${error}`);
      }
    })();

    return this.initPromise;
  }

  /**
   * Check if audio features are supported without initializing
   */
  static isAudioSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    );
  }

  /**
   * Get basic audio state without full initialization
   */
  getBasicState(): AudioState {
    if (!this.isInitialized) {
      return {
        isRecording: false,
        isPlaying: false,
        isSupported: LazyAudioController.isAudioSupported(),
        hasPermission: false,
        error: undefined
      };
    }
    
    return this.audioController.getState();
  }

  /**
   * Set state change callback (will be applied after initialization)
   */
  setStateChangeCallback(callback: (state: AudioState) => void): void {
    this.stateChangeCallback = callback;
    
    if (this.isInitialized && this.audioController) {
      this.audioController.setStateChangeCallback(callback);
    }
  }

  /**
   * Set transcription callback (will be applied after initialization)
   */
  setTranscriptionCallback(callback: (text: string) => void): void {
    this.transcriptionCallback = callback;
    
    if (this.isInitialized && this.audioController) {
      this.audioController.setTranscriptionCallback(callback);
    }
  }

  /**
   * Start recording (initializes if needed)
   */
  async startRecording(): Promise<void> {
    await this.initialize();
    return this.audioController.startRecording();
  }

  /**
   * Stop recording (requires initialization)
   */
  async stopRecording(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Audio controller not initialized');
    }
    return this.audioController.stopRecording();
  }

  /**
   * Speak text (initializes if needed)
   */
  async speakText(text: string, voiceSettings?: VoiceSettings): Promise<void> {
    await this.initialize();
    return this.audioController.speakText(text, voiceSettings);
  }

  /**
   * Pause speaking (requires initialization)
   */
  pauseSpeaking(): void {
    if (this.isInitialized && this.audioController) {
      this.audioController.pauseSpeaking();
    }
  }

  /**
   * Resume speaking (requires initialization)
   */
  resumeSpeaking(): void {
    if (this.isInitialized && this.audioController) {
      this.audioController.resumeSpeaking();
    }
  }

  /**
   * Stop speaking (requires initialization)
   */
  stopSpeaking(): void {
    if (this.isInitialized && this.audioController) {
      this.audioController.stopSpeaking();
    }
  }

  /**
   * Get current state (initializes if needed for full state)
   */
  async getState(): Promise<AudioState> {
    if (!this.isInitialized) {
      return this.getBasicState();
    }
    
    return this.audioController.getState();
  }

  /**
   * Recover from error (initializes if needed)
   */
  async recoverFromError(): Promise<boolean> {
    await this.initialize();
    return this.audioController.recoverFromError();
  }

  /**
   * Check if the controller is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if the controller is currently initializing
   */
  isLoading(): boolean {
    return this.isInitializing;
  }

  /**
   * Preload the audio controller without using it
   * Useful for warming up the module in the background
   */
  async preload(): Promise<void> {
    if (!this.isInitialized && !this.isInitializing) {
      // Start initialization but don't wait for it
      this.initialize().catch(error => {
        console.warn('Audio controller preload failed:', error);
      });
    }
  }

  /**
   * Destroy the audio controller and clean up resources
   */
  destroy(): void {
    if (this.isInitialized && this.audioController) {
      this.audioController.destroy();
    }
    
    this.audioController = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.initPromise = null;
    this.stateChangeCallback = undefined;
    this.transcriptionCallback = undefined;
  }
}

/**
 * Factory function for creating lazy audio controller instances
 */
export function createLazyAudioController(): LazyAudioController {
  return new LazyAudioController();
}

/**
 * Hook for using lazy audio controller with React
 */
// Note: React hooks would be imported from 'react' in actual usage
// This is just a placeholder for the hook pattern