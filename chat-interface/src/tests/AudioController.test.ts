import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { AudioController } from '../services/AudioController';
import { AudioError, AudioErrorCode } from '../types';

// Create fresh mock objects for each test
const createMockSpeechRecognition = () => ({
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  maxAlternatives: 1,
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  onstart: null as ((event: Event) => void) | null,
  onend: null as ((event: Event) => void) | null,
  onerror: null as ((event: any) => void) | null,
  onresult: null as ((event: any) => void) | null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
});

const createMockSpeechSynthesis = () => ({
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    { name: 'Voice 1', lang: 'en-US', default: true },
    { name: 'Voice 2', lang: 'en-GB', default: false }
  ]),
  speaking: false,
  pending: false,
  paused: false
});

const createMockSpeechSynthesisUtterance = () => vi.fn().mockImplementation((text: string) => ({
  text,
  lang: 'en-US',
  voice: null,
  volume: 1,
  rate: 1,
  pitch: 1,
  onstart: null,
  onend: null,
  onerror: null,
  onpause: null,
  onresume: null,
  onmark: null,
  onboundary: null
}));

let mockSpeechRecognition: ReturnType<typeof createMockSpeechRecognition>;
let mockSpeechSynthesis: ReturnType<typeof createMockSpeechSynthesis>;
let mockSpeechSynthesisUtterance: ReturnType<typeof createMockSpeechSynthesisUtterance>;
let mockGetUserMedia: Mock;

describe('AudioController', () => {
  let audioController: AudioController;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create fresh mocks for each test
    mockSpeechRecognition = createMockSpeechRecognition();
    mockSpeechSynthesis = createMockSpeechSynthesis();
    mockSpeechSynthesisUtterance = createMockSpeechSynthesisUtterance();
    mockGetUserMedia = vi.fn();

    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    });

    // Mock global objects
    Object.defineProperty(global, 'SpeechRecognition', {
      writable: true,
      value: vi.fn(() => mockSpeechRecognition)
    });

    Object.defineProperty(global, 'webkitSpeechRecognition', {
      writable: true,
      value: vi.fn(() => mockSpeechRecognition)
    });

    Object.defineProperty(global, 'speechSynthesis', {
      writable: true,
      value: mockSpeechSynthesis
    });

    Object.defineProperty(global, 'SpeechSynthesisUtterance', {
      writable: true,
      value: mockSpeechSynthesisUtterance
    });

    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: mockGetUserMedia
      }
    });

    Object.defineProperty(global, 'window', {
      writable: true,
      value: {
        SpeechRecognition: vi.fn(() => mockSpeechRecognition),
        webkitSpeechRecognition: vi.fn(() => mockSpeechRecognition),
        speechSynthesis: mockSpeechSynthesis
      }
    });

    audioController = new AudioController();
  });

  afterEach(() => {
    audioController.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with supported audio when Web Speech API is available', () => {
      const state = audioController.getState();
      expect(state.isSupported).toBe(true);
      expect(state.isRecording).toBe(false);
      expect(state.isPlaying).toBe(false);
      expect(state.hasPermission).toBe(false);
    });

    it('should initialize with unsupported audio when Web Speech API is not available', () => {
      // Mock missing Web Speech API
      Object.defineProperty(global, 'window', {
        writable: true,
        value: {
          SpeechRecognition: undefined,
          webkitSpeechRecognition: undefined,
          speechSynthesis: undefined
        }
      });

      const controller = new AudioController();
      const state = controller.getState();
      
      expect(state.isSupported).toBe(false);
      expect(state.error).toContain('Web Speech API not supported');
      
      controller.destroy();
    });
  });

  describe('Microphone Permission', () => {
    it('should successfully check microphone permission when granted', async () => {
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });

      const hasPermission = await audioController.checkMicrophonePermission();
      
      expect(hasPermission).toBe(true);
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      
      const state = audioController.getState();
      expect(state.hasPermission).toBe(true);
      expect(state.error).toBeUndefined();
    });

    it('should handle permission denied error', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      mockGetUserMedia.mockRejectedValue(permissionError);

      await expect(audioController.checkMicrophonePermission()).rejects.toThrow(AudioError);
      
      const state = audioController.getState();
      expect(state.hasPermission).toBe(false);
      expect(state.error).toContain('Microphone permission denied');
    });

    it('should handle no microphone found error', async () => {
      const notFoundError = new DOMException('No microphone found', 'NotFoundError');
      mockGetUserMedia.mockRejectedValue(notFoundError);

      await expect(audioController.checkMicrophonePermission()).rejects.toThrow(AudioError);
      
      const state = audioController.getState();
      expect(state.hasPermission).toBe(false);
      expect(state.error).toContain('No microphone found');
    });

    it('should handle unsupported media devices', async () => {
      Object.defineProperty(global.navigator, 'mediaDevices', {
        writable: true,
        value: undefined
      });

      const controller = new AudioController();
      
      await expect(controller.checkMicrophonePermission()).rejects.toThrow(AudioError);
      
      controller.destroy();
    });
  });

  describe('Speech Recognition', () => {
    it('should start recording successfully', async () => {
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });

      await audioController.startRecording();
      
      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    });

    it('should not start recording if not supported', async () => {
      // Create controller with no support
      Object.defineProperty(global, 'window', {
        writable: true,
        value: {
          SpeechRecognition: undefined,
          webkitSpeechRecognition: undefined,
          speechSynthesis: undefined
        }
      });

      const controller = new AudioController();
      
      await expect(controller.startRecording()).rejects.toThrow(AudioError);
      expect(mockSpeechRecognition.start).not.toHaveBeenCalled();
      
      controller.destroy();
    });

    it('should handle speech recognition start event', async () => {
      const stateChanges: any[] = [];
      audioController.setStateChangeCallback((state) => stateChanges.push(state));

      await audioController.startRecording();
      
      // Simulate onstart event
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart(new Event('start'));
      }

      const currentState = audioController.getState();
      expect(currentState.isRecording).toBe(true);
      expect(currentState.error).toBeUndefined();
    });

    it('should handle speech recognition result', async () => {
      const transcriptions: string[] = [];
      audioController.setTranscriptionCallback((text) => transcriptions.push(text));

      await audioController.startRecording();
      
      // Simulate onresult event
      const mockEvent = {
        results: [
          [{ transcript: 'Hello world', confidence: 0.9 }]
        ]
      };
      
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockEvent as any);
      }

      expect(transcriptions).toContain('Hello world');
    });

    it('should handle speech recognition end event', async () => {
      await audioController.startRecording();
      
      // Simulate onend event
      if (mockSpeechRecognition.onend) {
        mockSpeechRecognition.onend(new Event('end'));
      }

      const state = audioController.getState();
      expect(state.isRecording).toBe(false);
    });

    it('should handle speech recognition errors', async () => {
      await audioController.startRecording();
      
      // Simulate onerror event
      const mockErrorEvent = {
        error: 'not-allowed',
        message: 'Permission denied'
      };
      
      expect(() => {
        if (mockSpeechRecognition.onerror) {
          mockSpeechRecognition.onerror(mockErrorEvent);
        }
      }).toThrow(AudioError);

      const state = audioController.getState();
      expect(state.isRecording).toBe(false);
      expect(state.hasPermission).toBe(false);
      expect(state.error).toContain('Microphone permission denied');
    });

    it('should stop recording', async () => {
      await audioController.startRecording();
      
      // Simulate recording started
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart(new Event('start'));
      }
      
      audioController.stopRecording();
      
      expect(mockSpeechRecognition.stop).toHaveBeenCalled();
    });

    it('should not stop recording if not recording', () => {
      audioController.stopRecording();
      expect(mockSpeechRecognition.stop).not.toHaveBeenCalled();
    });
  });

  describe('Text-to-Speech', () => {
    it('should speak text successfully', async () => {
      await audioController.speakText('Hello world');
      
      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith('Hello world');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should apply voice settings', async () => {
      const voiceSettings = {
        rate: 1.5,
        pitch: 1.2,
        voice: 'Voice 1'
      };

      await audioController.speakText('Hello world', voiceSettings);
      
      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith('Hello world');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should handle text-to-speech start event', async () => {
      const utterance = { onstart: null, onend: null, onerror: null };
      mockSpeechSynthesisUtterance.mockReturnValue(utterance);

      await audioController.speakText('Hello world');
      
      // Simulate onstart event
      if (utterance.onstart) {
        utterance.onstart(new Event('start'));
      }

      const state = audioController.getState();
      expect(state.isPlaying).toBe(true);
    });

    it('should handle text-to-speech end event', async () => {
      const utterance = { onstart: null, onend: null, onerror: null };
      mockSpeechSynthesisUtterance.mockReturnValue(utterance);

      await audioController.speakText('Hello world');
      
      // Simulate onend event
      if (utterance.onend) {
        utterance.onend(new Event('end'));
      }

      const state = audioController.getState();
      expect(state.isPlaying).toBe(false);
    });

    it('should handle text-to-speech error', async () => {
      const utterance = { onstart: null, onend: null, onerror: null };
      mockSpeechSynthesisUtterance.mockReturnValue(utterance);

      const speakPromise = audioController.speakText('Hello world');
      
      // Simulate onerror event
      if (utterance.onerror) {
        const errorEvent = { error: 'synthesis-failed' };
        expect(() => utterance.onerror(errorEvent)).toThrow(AudioError);
      }

      const state = audioController.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.error).toContain('Text-to-speech error');
    });

    it('should stop current speech before starting new one', async () => {
      // Start first speech and simulate it playing
      const firstUtterance = { onstart: null, onend: null, onerror: null };
      mockSpeechSynthesisUtterance.mockReturnValueOnce(firstUtterance);
      
      await audioController.speakText('First text');
      
      // Simulate first speech starting
      if (firstUtterance.onstart) {
        firstUtterance.onstart(new Event('start'));
      }
      
      // Start second speech - should cancel first
      const secondUtterance = { onstart: null, onend: null, onerror: null };
      mockSpeechSynthesisUtterance.mockReturnValueOnce(secondUtterance);
      
      await audioController.speakText('Second text');
      
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);
    });

    it('should stop speaking', async () => {
      await audioController.speakText('Hello world');
      audioController.stopSpeaking();
      
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
      
      const state = audioController.getState();
      expect(state.isPlaying).toBe(false);
    });

    it('should throw error when synthesis not supported', async () => {
      // Mock missing synthesis
      Object.defineProperty(global, 'window', {
        writable: true,
        value: {
          SpeechRecognition: vi.fn(() => mockSpeechRecognition),
          webkitSpeechRecognition: vi.fn(() => mockSpeechRecognition),
          speechSynthesis: undefined
        }
      });

      const controller = new AudioController();
      
      await expect(controller.speakText('Hello')).rejects.toThrow(AudioError);
      
      controller.destroy();
    });
  });

  describe('Voice Management', () => {
    it('should get available voices', () => {
      const voices = audioController.getAvailableVoices();
      
      expect(mockSpeechSynthesis.getVoices).toHaveBeenCalled();
      expect(voices).toHaveLength(2);
      expect(voices[0].name).toBe('Voice 1');
    });

    it('should return empty array when synthesis not available', () => {
      Object.defineProperty(global, 'window', {
        writable: true,
        value: {
          SpeechRecognition: vi.fn(() => mockSpeechRecognition),
          webkitSpeechRecognition: vi.fn(() => mockSpeechRecognition),
          speechSynthesis: undefined
        }
      });

      const controller = new AudioController();
      const voices = controller.getAvailableVoices();
      
      expect(voices).toHaveLength(0);
      
      controller.destroy();
    });
  });

  describe('State Management', () => {
    it('should notify state changes', async () => {
      const stateChanges: any[] = [];
      audioController.setStateChangeCallback((state) => stateChanges.push(state));

      // Trigger a state change
      await audioController.checkMicrophonePermission();

      expect(stateChanges.length).toBeGreaterThan(0);
    });

    it('should get current state', () => {
      const state = audioController.getState();
      
      expect(state).toHaveProperty('isRecording');
      expect(state).toHaveProperty('isPlaying');
      expect(state).toHaveProperty('isSupported');
      expect(state).toHaveProperty('hasPermission');
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const stateCallback = vi.fn();
      const transcriptionCallback = vi.fn();
      
      audioController.setStateChangeCallback(stateCallback);
      audioController.setTranscriptionCallback(transcriptionCallback);
      
      audioController.destroy();
      
      // Callbacks should be cleared
      expect(audioController['stateChangeCallback']).toBeNull();
      expect(audioController['transcriptionCallback']).toBeNull();
    });
  });
});