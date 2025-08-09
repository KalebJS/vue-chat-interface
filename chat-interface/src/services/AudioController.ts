import { AudioState, AudioError, AudioErrorCode, VoiceSettings } from '../types';

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
   * Clean up resources
   */
  destroy(): void {
    this.stopRecording();
    this.stopSpeaking();
    this.stateChangeCallback = null;
    this.transcriptionCallback = null;
  }
}