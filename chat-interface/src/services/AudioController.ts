import type { AudioState, VoiceSettings } from '../types';
import { AudioError, AudioErrorCode } from '../types';

/**
 * AudioController handles Web Speech API interactions for speech recognition and synthesis
 * Provides speech-to-text and text-to-speech functionality with proper error handling
 */
export class AudioController {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioState: AudioState;
  private stateChangeCallback: ((state: AudioState) => void) | null = null;
  private transcriptionCallback: ((text: string) => void) | null = null;

  constructor() {
    this.audioState = {
      isRecording: false,
      isPlaying: false,
      isPaused: false,
      isSupported: false,
      hasPermission: false,
      error: undefined
    };

    this.initializeAudioSupport();
  }

  /**
   * Initialize audio support by checking browser compatibility
   */
  private initializeAudioSupport(): void {
    try {
      // Check for Speech Recognition support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const speechSynthesis = window.speechSynthesis;

      if (SpeechRecognition && speechSynthesis) {
        this.recognition = new SpeechRecognition();
        this.synthesis = speechSynthesis;
        this.setupSpeechRecognition();
        this.updateState({ isSupported: true });
      } else {
        this.updateState({ 
          isSupported: false,
          error: 'Web Speech API not supported in this browser'
        });
      }
    } catch (error) {
      this.updateState({ 
        isSupported: false,
        error: 'Failed to initialize audio support'
      });
    }
  }

  /**
   * Configure speech recognition settings
   */
  private setupSpeechRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.updateState({ isRecording: true, error: undefined });
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      if (this.transcriptionCallback) {
        this.transcriptionCallback(transcript);
      }
    };

    this.recognition.onend = () => {
      this.updateState({ isRecording: false });
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Speech recognition error';
      let errorCode = AudioErrorCode.SPEECH_RECOGNITION_FAILED;

      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Microphone permission denied';
          errorCode = AudioErrorCode.PERMISSION_DENIED;
          this.updateState({ hasPermission: false });
          break;
        case 'no-speech':
          errorMessage = 'No speech detected';
          break;
        case 'audio-capture':
          errorMessage = 'Audio capture failed';
          break;
        case 'network':
          errorMessage = 'Network error during speech recognition';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      this.updateState({ 
        isRecording: false,
        error: errorMessage
      });

      throw new AudioError(errorMessage, errorCode);
    };
  }

  /**
   * Check and request microphone permissions
   */
  async checkMicrophonePermission(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new AudioError(
          'Media devices not supported',
          AudioErrorCode.NOT_SUPPORTED
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately as we only needed to check permission
      stream.getTracks().forEach(track => track.stop());
      
      this.updateState({ hasPermission: true, error: undefined });
      return true;
    } catch (error) {
      let errorMessage = 'Microphone permission denied';
      let errorCode = AudioErrorCode.PERMISSION_DENIED;

      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Microphone permission denied by user';
            break;
          case 'NotFoundError':
            errorMessage = 'No microphone found';
            break;
          case 'NotSupportedError':
            errorMessage = 'Microphone not supported';
            errorCode = AudioErrorCode.NOT_SUPPORTED;
            break;
          default:
            errorMessage = `Microphone access error: ${error.message}`;
        }
      }

      this.updateState({ 
        hasPermission: false,
        error: errorMessage
      });

      throw new AudioError(errorMessage, errorCode, error as Error);
    }
  }

  /**
   * Start speech recognition
   */
  async startRecording(): Promise<void> {
    if (!this.audioState.isSupported) {
      throw new AudioError(
        'Speech recognition not supported',
        AudioErrorCode.NOT_SUPPORTED
      );
    }

    if (!this.recognition) {
      throw new AudioError(
        'Speech recognition not initialized',
        AudioErrorCode.RECORDING_FAILED
      );
    }

    if (this.audioState.isRecording) {
      return; // Already recording
    }

    try {
      // Check permissions before starting
      await this.checkMicrophonePermission();
      
      this.recognition.start();
    } catch (error) {
      const audioError = error instanceof AudioError 
        ? error 
        : new AudioError(
            'Failed to start recording',
            AudioErrorCode.RECORDING_FAILED,
            error as Error
          );
      
      this.updateState({ 
        isRecording: false,
        error: audioError.message
      });
      
      throw audioError;
    }
  }

  /**
   * Stop speech recognition
   */
  stopRecording(): void {
    if (!this.recognition || !this.audioState.isRecording) {
      return;
    }

    try {
      this.recognition.stop();
    } catch (error) {
      this.updateState({ 
        isRecording: false,
        error: 'Failed to stop recording'
      });
    }
  }

  /**
   * Convert text to speech and play it
   */
  async speakText(text: string, voiceSettings?: VoiceSettings): Promise<void> {
    if (!this.synthesis) {
      throw new AudioError(
        'Text-to-speech not supported',
        AudioErrorCode.NOT_SUPPORTED
      );
    }

    if (this.audioState.isPlaying) {
      this.stopSpeaking();
    }

    try {
      this.currentUtterance = new SpeechSynthesisUtterance(text);
      
      // Apply voice settings if provided
      if (voiceSettings) {
        this.currentUtterance.rate = voiceSettings.rate || 1;
        this.currentUtterance.pitch = voiceSettings.pitch || 1;
        
        if (voiceSettings.voice) {
          const voices = this.synthesis.getVoices();
          const selectedVoice = voices.find(voice => voice.name === voiceSettings.voice);
          if (selectedVoice) {
            this.currentUtterance.voice = selectedVoice;
          }
        }
      }

      this.currentUtterance.onstart = () => {
        this.updateState({ isPlaying: true, isPaused: false, error: undefined });
      };

      this.currentUtterance.onend = () => {
        this.updateState({ isPlaying: false, isPaused: false });
        this.currentUtterance = null;
      };

      this.currentUtterance.onerror = (event) => {
        this.updateState({ 
          isPlaying: false,
          isPaused: false,
          error: `Text-to-speech error: ${event.error}`
        });
        this.currentUtterance = null;
        
        throw new AudioError(
          `Text-to-speech failed: ${event.error}`,
          AudioErrorCode.TEXT_TO_SPEECH_FAILED
        );
      };

      this.synthesis.speak(this.currentUtterance);
    } catch (error) {
      const audioError = error instanceof AudioError
        ? error
        : new AudioError(
            'Failed to speak text',
            AudioErrorCode.TEXT_TO_SPEECH_FAILED,
            error as Error
          );
      
      this.updateState({ 
        isPlaying: false,
        isPaused: false,
        error: audioError.message
      });
      
      throw audioError;
    }
  }

  /**
   * Stop current speech synthesis
   */
  stopSpeaking(): void {
    if (!this.synthesis) return;

    try {
      this.synthesis.cancel();
      this.updateState({ isPlaying: false, isPaused: false });
      this.currentUtterance = null;
    } catch (error) {
      this.updateState({ 
        isPlaying: false,
        isPaused: false,
        error: 'Failed to stop speech'
      });
    }
  }

  /**
   * Pause current speech synthesis
   */
  pauseSpeaking(): void {
    if (!this.synthesis || !this.currentUtterance || !this.audioState.isPlaying) {
      return;
    }

    try {
      this.synthesis.pause();
      this.updateState({ isPlaying: false, isPaused: true });
    } catch (error) {
      this.updateState({ 
        error: 'Failed to pause speech'
      });
    }
  }

  /**
   * Resume paused speech synthesis
   */
  resumeSpeaking(): void {
    if (!this.synthesis || !this.currentUtterance || !this.audioState.isPaused) {
      return;
    }

    try {
      this.synthesis.resume();
      this.updateState({ isPlaying: true, isPaused: false, error: undefined });
    } catch (error) {
      this.updateState({ 
        error: 'Failed to resume speech'
      });
    }
  }

  /**
   * Check if speech synthesis is currently paused
   */
  isSpeechPaused(): boolean {
    return this.synthesis ? this.synthesis.paused : false;
  }

  /**
   * Check if speech synthesis is currently speaking
   */
  isSpeechSpeaking(): boolean {
    return this.synthesis ? this.synthesis.speaking : false;
  }

  /**
   * Get available voices for text-to-speech
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  /**
   * Get current audio state
   */
  getState(): AudioState {
    return { ...this.audioState };
  }

  /**
   * Subscribe to state changes
   */
  setStateChangeCallback(callback: (state: AudioState) => void): void {
    this.stateChangeCallback = callback;
  }

  /**
   * Subscribe to transcription results
   */
  setTranscriptionCallback(callback: (text: string) => void): void {
    this.transcriptionCallback = callback;
  }

  /**
   * Update internal state and notify subscribers
   */
  private updateState(updates: Partial<AudioState>): void {
    this.audioState = { ...this.audioState, ...updates };
    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.audioState);
    }
  }

  /**
   * Test audio functionality and return capability report
   */
  async testAudioCapabilities(): Promise<{
    speechRecognition: boolean;
    speechSynthesis: boolean;
    microphone: boolean;
    errors: string[];
  }> {
    const result = {
      speechRecognition: false,
      speechSynthesis: false,
      microphone: false,
      errors: [] as string[]
    };

    // Test speech recognition
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      result.speechRecognition = !!SpeechRecognition;
      if (!result.speechRecognition) {
        result.errors.push('Speech recognition not supported in this browser');
      }
    } catch (error) {
      result.errors.push('Failed to test speech recognition support');
    }

    // Test speech synthesis
    try {
      result.speechSynthesis = !!window.speechSynthesis;
      if (!result.speechSynthesis) {
        result.errors.push('Speech synthesis not supported in this browser');
      }
    } catch (error) {
      result.errors.push('Failed to test speech synthesis support');
    }

    // Test microphone access
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        result.microphone = true;
      } else {
        result.errors.push('Microphone access not supported');
      }
    } catch (error) {
      result.errors.push('Microphone permission denied or unavailable');
    }

    return result;
  }

  /**
   * Get detailed error information for troubleshooting
   */
  getErrorDiagnostics(): {
    browserSupport: {
      speechRecognition: boolean;
      speechSynthesis: boolean;
      mediaDevices: boolean;
    };
    permissions: {
      microphone: boolean;
    };
    currentState: AudioState;
    recommendations: string[];
  } {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    const diagnostics = {
      browserSupport: {
        speechRecognition: !!SpeechRecognition,
        speechSynthesis: !!window.speechSynthesis,
        mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      },
      permissions: {
        microphone: this.audioState.hasPermission
      },
      currentState: { ...this.audioState },
      recommendations: [] as string[]
    };

    // Generate recommendations based on diagnostics
    if (!diagnostics.browserSupport.speechRecognition) {
      diagnostics.recommendations.push('Use a modern browser like Chrome, Edge, or Safari for speech recognition');
    }

    if (!diagnostics.browserSupport.speechSynthesis) {
      diagnostics.recommendations.push('Speech synthesis requires a modern browser');
    }

    if (!diagnostics.browserSupport.mediaDevices) {
      diagnostics.recommendations.push('Microphone access requires HTTPS and a modern browser');
    }

    if (!diagnostics.permissions.microphone) {
      diagnostics.recommendations.push('Grant microphone permission in browser settings');
    }

    if (this.audioState.error) {
      diagnostics.recommendations.push('Check browser console for detailed error information');
    }

    return diagnostics;
  }

  /**
   * Attempt to recover from audio errors
   */
  async recoverFromError(): Promise<boolean> {
    try {
      // Reset error state
      this.updateState({ error: undefined });

      // Reinitialize audio support
      this.initializeAudioSupport();

      // Test capabilities
      const capabilities = await this.testAudioCapabilities();
      
      if (capabilities.errors.length === 0) {
        this.updateState({ 
          isSupported: true,
          hasPermission: capabilities.microphone
        });
        return true;
      } else {
        this.updateState({ 
          error: `Recovery failed: ${capabilities.errors.join(', ')}`
        });
        return false;
      }
    } catch (error) {
      this.updateState({ 
        error: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return false;
    }
  }

  /**
   * Gracefully degrade audio features
   */
  gracefullyDegrade(): void {
    // Stop any ongoing audio operations
    this.stopRecording();
    this.stopSpeaking();

    // Update state to reflect degraded mode
    this.updateState({
      isSupported: false,
      hasPermission: false,
      isRecording: false,
      isPlaying: false,
      isPaused: false,
      error: 'Audio features disabled due to errors'
    });

    console.warn('Audio features have been gracefully degraded to text-only mode');
  }

  /**
   * Check if audio features should be available based on environment
   */
  shouldAudioBeAvailable(): {
    available: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Check HTTPS requirement
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      reasons.push('HTTPS is required for audio features');
    }

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reasons.push('Browser does not support speech recognition');
    }

    if (!window.speechSynthesis) {
      reasons.push('Browser does not support speech synthesis');
    }

    // Check media devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      reasons.push('Browser does not support media device access');
    }

    return {
      available: reasons.length === 0,
      reasons
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopRecording();
    this.stopSpeaking();
    this.stateChangeCallback = null;
    this.transcriptionCallback = null;
  }
}