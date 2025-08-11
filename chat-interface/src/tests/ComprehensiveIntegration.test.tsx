import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../components/ChatInterface';
import { LangChainService } from '../services/LangChainService';
import { AudioController } from '../services/AudioController';
import { StateManager } from '../services/StateManager';
import { NetworkErrorHandler } from '../services/NetworkErrorHandler';

// Mock all services
vi.mock('../services/LangChainService');
vi.mock('../services/AudioController');
vi.mock('../services/StateManager');
vi.mock('../services/NetworkErrorHandler');

describe('Comprehensive Integration Tests', () => {
  let mockLangChainService: any;
  let mockAudioController: any;
  let mockStateManager: any;
  let mockNetworkErrorHandler: any;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Mock LangChain Service
    mockLangChainService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(true),
      sendMessage: vi.fn().mockResolvedValue('AI response'),
      sendMessageStreaming: vi.fn().mockImplementation(async (message, options) => {
        const response = 'Streaming AI response';
        const words = response.split(' ');
        for (const word of words) {
          const token = word === words[0] ? word : ' ' + word;
          options.onToken?.(token);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        options.onComplete?.(response);
        return response;
      }),
      getState: vi.fn().mockReturnValue({
        isInitialized: true,
        currentModel: 'gpt-3.5-turbo',
        conversationId: 'test-conv',
        tokenCount: 0,
        memorySize: 0,
        isStreaming: false
      }),
      getConversationHistory: vi.fn().mockResolvedValue([]),
      clearMemory: vi.fn().mockResolvedValue(undefined),
      updateModelConfig: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn()
    };

    // Mock Audio Controller
    mockAudioController = {
      getState: vi.fn().mockReturnValue({
        isRecording: false,
        isPlaying: false,
        isPaused: false,
        isSupported: true,
        hasPermission: true,
        error: undefined
      }),
      setStateChangeCallback: vi.fn(),
      setTranscriptionCallback: vi.fn(),
      startRecording: vi.fn().mockResolvedValue(undefined),
      stopRecording: vi.fn().mockResolvedValue('Transcribed text'),
      speakText: vi.fn().mockResolvedValue(undefined),
      pauseSpeaking: vi.fn(),
      resumeSpeaking: vi.fn(),
      stopSpeaking: vi.fn(),
      recoverFromError: vi.fn().mockResolvedValue(true),
      destroy: vi.fn()
    };

    // Mock State Manager
    mockStateManager = {
      getState: vi.fn().mockReturnValue({
        messages: [],
        currentInput: '',
        isLoading: false,
        audioState: {
          isRecording: false,
          isPlaying: false,
          isPaused: false,
          isSupported: true,
          hasPermission: true,
          error: undefined
        },
        langChainState: {
          isInitialized: true,
          currentModel: 'gpt-3.5-turbo',
          conversationId: 'test-conv',
          tokenCount: 0,
          memorySize: 0,
          isStreaming: false
        },
        error: undefined,
        settings: {
          autoScroll: true,
          audioEnabled: true,
          voiceSettings: { rate: 1, pitch: 1, voice: 'default' },
          aiModel: {
            model: { provider: 'openai', modelName: 'gpt-3.5-turbo', temperature: 0.7, maxTokens: 1000 },
            memory: { type: 'buffer' },
            chain: { type: 'conversation' }
          }
        }
      }),
      subscribe: vi.fn().mockReturnValue(() => {}),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      sendMessageWithStreaming: vi.fn().mockResolvedValue(undefined),
      updateCurrentInput: vi.fn(),
      updateError: vi.fn(),
      updateAudioState: vi.fn(),
      initializeLangChain: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn()
    };

    // Mock Network Error Handler
    mockNetworkErrorHandler = {
      isOnline: vi.fn().mockReturnValue(true),
      setupConnectionMonitoring: vi.fn().mockReturnValue(() => {}),
      executeWithRetry: vi.fn().mockImplementation(async (fn) => await fn())
    };

    // Set up mocks
    vi.mocked(LangChainService).mockImplementation(() => mockLangChainService);
    vi.mocked(AudioController).mockImplementation(() => mockAudioController);
    vi.mocked(StateManager).mockImplementation(() => mockStateManager);
    vi.mocked(NetworkErrorHandler).mockImplementation(() => mockNetworkErrorHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Conversation Flows', () => {
    it('should handle complete text conversation flow', async () => {
      render(<ChatInterface />);

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Send first message
      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByLabelText('Send message');

      await user.type(input, 'Hello, how are you?');
      await user.click(sendButton);

      // Verify message was sent
      expect(mockStateManager.sendMessage).toHaveBeenCalledWith('Hello, how are you?');

      // Simulate message appearing in state
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        messages: [
          {
            id: '1',
            text: 'Hello, how are you?',
            sender: 'user',
            timestamp: new Date(),
            status: 'sent'
          },
          {
            id: '2',
            text: 'AI response',
            sender: 'ai',
            timestamp: new Date(),
            status: 'sent'
          }
        ]
      });

      // Re-render to show updated state
      render(<ChatInterface />);

      // Verify conversation history
      await waitFor(() => {
        expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
        expect(screen.getByText('AI response')).toBeInTheDocument();
      });

      // Send follow-up message
      await user.type(input, 'Tell me more');
      await user.click(sendButton);

      expect(mockStateManager.sendMessage).toHaveBeenCalledWith('Tell me more');
    });

    it('should handle streaming conversation flow', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByLabelText('Send message');

      await user.type(input, 'Stream response please');
      await user.click(sendButton);

      // Verify streaming was initiated
      expect(mockStateManager.sendMessageWithStreaming).toHaveBeenCalledWith('Stream response please');

      // Simulate streaming state
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        langChainState: {
          ...mockStateManager.getState().langChainState,
          isStreaming: true
        },
        messages: [
          {
            id: '1',
            text: 'Stream response please',
            sender: 'user',
            timestamp: new Date(),
            status: 'sent'
          },
          {
            id: '2',
            text: 'Streaming',
            sender: 'ai',
            timestamp: new Date(),
            status: 'sending',
            isStreaming: true
          }
        ]
      });

      render(<ChatInterface />);

      // Should show streaming indicator
      await waitFor(() => {
        expect(screen.getByLabelText('AI is typing')).toBeInTheDocument();
      });
    });

    it('should maintain conversation context across multiple messages', async () => {
      const conversationHistory = [
        { id: '1', text: 'What is React?', sender: 'user', timestamp: new Date(), status: 'sent' },
        { id: '2', text: 'React is a JavaScript library', sender: 'ai', timestamp: new Date(), status: 'sent' },
        { id: '3', text: 'How do I use hooks?', sender: 'user', timestamp: new Date(), status: 'sent' },
        { id: '4', text: 'Hooks are functions that let you use state', sender: 'ai', timestamp: new Date(), status: 'sent' }
      ];

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        messages: conversationHistory
      });

      render(<ChatInterface />);

      // All messages should be visible
      await waitFor(() => {
        expect(screen.getByText('What is React?')).toBeInTheDocument();
        expect(screen.getByText('React is a JavaScript library')).toBeInTheDocument();
        expect(screen.getByText('How do I use hooks?')).toBeInTheDocument();
        expect(screen.getByText('Hooks are functions that let you use state')).toBeInTheDocument();
      });

      // Send new message that references context
      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Can you give me an example?');
      await user.click(screen.getByLabelText('Send message'));

      // Context should be maintained
      expect(mockStateManager.sendMessage).toHaveBeenCalledWith('Can you give me an example?');
    });
  });

  describe('Audio Recording to AI Response to Text-to-Speech Cycle', () => {
    it('should handle complete audio interaction cycle', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Start recording
      const recordButton = screen.getByLabelText('Start recording');
      await user.click(recordButton);

      expect(mockAudioController.startRecording).toHaveBeenCalled();

      // Simulate recording state
      mockAudioController.getState.mockReturnValue({
        ...mockAudioController.getState(),
        isRecording: true
      });

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        audioState: {
          ...mockStateManager.getState().audioState,
          isRecording: true
        }
      });

      render(<ChatInterface />);

      // Should show recording indicator
      await waitFor(() => {
        expect(screen.getByLabelText('Recording in progress')).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = screen.getByLabelText('Stop recording');
      await user.click(stopButton);

      expect(mockAudioController.stopRecording).toHaveBeenCalled();

      // Simulate transcription callback
      const transcriptionCallback = mockAudioController.setTranscriptionCallback.mock.calls[0][0];
      act(() => {
        transcriptionCallback('Hello AI, how are you?');
      });

      // Message should be sent automatically
      expect(mockStateManager.sendMessage).toHaveBeenCalledWith('Hello AI, how are you?');

      // Simulate AI response
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        messages: [
          {
            id: '1',
            text: 'Hello AI, how are you?',
            sender: 'user',
            timestamp: new Date(),
            status: 'sent'
          },
          {
            id: '2',
            text: 'I am doing well, thank you!',
            sender: 'ai',
            timestamp: new Date(),
            status: 'sent'
          }
        ]
      });

      render(<ChatInterface />);

      // Find and click play audio button for AI response
      const playButtons = screen.getAllByLabelText('Play audio');
      const aiMessagePlayButton = playButtons.find(button => 
        button.closest('.message-item')?.textContent?.includes('I am doing well, thank you!')
      );
      
      if (aiMessagePlayButton) {
        await user.click(aiMessagePlayButton);
        expect(mockAudioController.speakText).toHaveBeenCalledWith('I am doing well, thank you!');
      }
    });

    it('should handle audio permission errors gracefully', async () => {
      // Mock permission denied
      mockAudioController.getState.mockReturnValue({
        ...mockAudioController.getState(),
        hasPermission: false,
        error: 'Microphone permission denied'
      });

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        audioState: {
          ...mockStateManager.getState().audioState,
          hasPermission: false,
          error: 'Microphone permission denied'
        }
      });

      render(<ChatInterface />);

      // Should show audio unavailable message
      await waitFor(() => {
        expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Microphone permission denied')).toBeInTheDocument();
      });

      // Text input should still work
      const input = screen.getByPlaceholderText('Type your message...');
      expect(input).toBeInTheDocument();
      expect(input).not.toBeDisabled();
    });

    it('should handle speech recognition errors', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Start recording
      const recordButton = screen.getByLabelText('Start recording');
      await user.click(recordButton);

      // Simulate recording error
      mockAudioController.getState.mockReturnValue({
        ...mockAudioController.getState(),
        isRecording: false,
        error: 'Speech recognition failed'
      });

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        audioState: {
          ...mockStateManager.getState().audioState,
          isRecording: false,
          error: 'Speech recognition failed'
        }
      });

      render(<ChatInterface />);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Speech recognition failed')).toBeInTheDocument();
      });

      // Should provide retry option
      const retryButton = screen.getByText('Try Again');
      await user.click(retryButton);

      expect(mockAudioController.recoverFromError).toHaveBeenCalled();
    });

    it('should handle text-to-speech playback controls', async () => {
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        messages: [
          {
            id: '1',
            text: 'This is a test message for audio playback',
            sender: 'ai',
            timestamp: new Date(),
            status: 'sent'
          }
        ]
      });

      render(<ChatInterface />);

      // Find play button
      const playButton = screen.getByLabelText('Play audio');
      await user.click(playButton);

      expect(mockAudioController.speakText).toHaveBeenCalledWith('This is a test message for audio playback');

      // Simulate playing state
      mockAudioController.getState.mockReturnValue({
        ...mockAudioController.getState(),
        isPlaying: true
      });

      render(<ChatInterface />);

      // Should show pause button
      const pauseButton = screen.getByLabelText('Pause audio');
      await user.click(pauseButton);

      expect(mockAudioController.pauseSpeaking).toHaveBeenCalled();

      // Should show stop button
      const stopButton = screen.getByLabelText('Stop audio');
      await user.click(stopButton);

      expect(mockAudioController.stopSpeaking).toHaveBeenCalled();
    });
  });
});  des
cribe('Cross-Browser Compatibility Tests', () => {
    it('should detect and handle Web Speech API support', async () => {
      // Mock unsupported browser
      const originalSpeechRecognition = window.SpeechRecognition;
      const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;
      
      // @ts-ignore
      delete window.SpeechRecognition;
      // @ts-ignore
      delete window.webkitSpeechRecognition;

      mockAudioController.getState.mockReturnValue({
        ...mockAudioController.getState(),
        isSupported: false,
        error: 'Speech recognition not supported in this browser'
      });

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        audioState: {
          ...mockStateManager.getState().audioState,
          isSupported: false,
          error: 'Speech recognition not supported in this browser'
        }
      });

      render(<ChatInterface />);

      // Should show unsupported message
      await waitFor(() => {
        expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Speech recognition not supported in this browser')).toBeInTheDocument();
      });

      // Text interface should still work
      const input = screen.getByPlaceholderText('Type your message...');
      expect(input).toBeInTheDocument();

      // Restore original values
      window.SpeechRecognition = originalSpeechRecognition;
      window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
    });

    it('should handle different speech synthesis voice availability', async () => {
      // Mock different voice scenarios
      const mockVoices = [
        { name: 'Voice 1', lang: 'en-US', voiceURI: 'voice1', localService: true, default: true },
        { name: 'Voice 2', lang: 'en-GB', voiceURI: 'voice2', localService: false, default: false }
      ] as SpeechSynthesisVoice[];

      Object.defineProperty(window.speechSynthesis, 'getVoices', {
        value: vi.fn(() => mockVoices)
      });

      render(<ChatInterface />);

      // Open settings to check voice options
      const settingsButton = screen.getByLabelText(/open settings/i);
      await user.click(settingsButton);

      // Should show available voices
      await waitFor(() => {
        expect(screen.getByText('Voice 1 (en-US)')).toBeInTheDocument();
        expect(screen.getByText('Voice 2 (en-GB)')).toBeInTheDocument();
      });
    });

    it('should handle offline/online state changes', async () => {
      render(<ChatInterface />);

      // Simulate going offline
      mockNetworkErrorHandler.isOnline.mockReturnValue(false);
      
      // Trigger network state change
      fireEvent(window, new Event('offline'));

      await waitFor(() => {
        expect(screen.getByText(/You're offline/)).toBeInTheDocument();
      });

      // Simulate going back online
      mockNetworkErrorHandler.isOnline.mockReturnValue(true);
      fireEvent(window, new Event('online'));

      await waitFor(() => {
        expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
      });
    });

    it('should handle different screen sizes and responsive behavior', async () => {
      // Mock different viewport sizes
      const originalInnerWidth = window.innerWidth;
      const originalInnerHeight = window.innerHeight;

      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

      render(<ChatInterface />);

      // Should render mobile-friendly interface
      expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();

      // Test desktop viewport
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

      // Trigger resize
      fireEvent(window, new Event('resize'));

      // Interface should still be functional
      expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();

      // Restore original values
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
    });

    it('should handle touch vs mouse interactions', async () => {
      render(<ChatInterface />);

      const recordButton = screen.getByLabelText('Start recording');

      // Test touch events
      fireEvent.touchStart(recordButton);
      fireEvent.touchEnd(recordButton);

      expect(mockAudioController.startRecording).toHaveBeenCalled();

      // Test mouse events
      await user.click(screen.getByLabelText('Stop recording'));
      expect(mockAudioController.stopRecording).toHaveBeenCalled();
    });
  });

  describe('Performance Tests for Long Conversations and Memory Usage', () => {
    it('should handle large conversation histories efficiently', async () => {
      // Generate large conversation history
      const largeConversation = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        text: `Message ${i}: This is a test message with some content to simulate real conversation data.`,
        sender: i % 2 === 0 ? 'user' : 'ai' as const,
        timestamp: new Date(Date.now() - (1000 - i) * 60000),
        status: 'sent' as const
      }));

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        messages: largeConversation
      });

      const startTime = performance.now();
      render(<ChatInterface />);

      // Should render without significant delay
      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second

      // Should show recent messages
      expect(screen.getByText('Message 999: This is a test message with some content to simulate real conversation data.')).toBeInTheDocument();
    });

    it('should manage memory usage with conversation cleanup', async () => {
      const initialMemoryUsage = (performance as any).memory?.usedJSHeapSize || 0;

      // Create and destroy multiple conversation instances
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<ChatInterface />);
        
        // Add some messages
        mockStateManager.getState.mockReturnValue({
          ...mockStateManager.getState(),
          messages: Array.from({ length: 100 }, (_, j) => ({
            id: `msg-${i}-${j}`,
            text: `Message ${j}`,
            sender: j % 2 === 0 ? 'user' : 'ai' as const,
            timestamp: new Date(),
            status: 'sent' as const
          }))
        });

        await waitFor(() => {
          expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
        });

        unmount();
      }

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory usage should not grow excessively (allow for some variance)
      if (initialMemoryUsage > 0 && finalMemoryUsage > 0) {
        const memoryGrowth = finalMemoryUsage - initialMemoryUsage;
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
      }
    });

    it('should handle rapid message sending without performance degradation', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByLabelText('Send message');

      const startTime = performance.now();

      // Send multiple messages rapidly
      for (let i = 0; i < 20; i++) {
        await user.clear(input);
        await user.type(input, `Rapid message ${i}`);
        await user.click(sendButton);
      }

      const totalTime = performance.now() - startTime;
      
      // Should handle rapid sending efficiently
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds for 20 messages
      expect(mockStateManager.sendMessage).toHaveBeenCalledTimes(20);
    });

    it('should handle streaming performance with long responses', async () => {
      // Mock long streaming response
      const longResponse = 'This is a very long response that simulates a detailed AI answer with multiple paragraphs and extensive content. '.repeat(100);
      
      mockLangChainService.sendMessageStreaming.mockImplementation(async (message, options) => {
        const words = longResponse.split(' ');
        const startTime = performance.now();
        
        for (let i = 0; i < words.length; i++) {
          const token = i === 0 ? words[i] : ' ' + words[i];
          options.onToken?.(token);
          
          // Simulate realistic streaming delay
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
        
        const streamingTime = performance.now() - startTime;
        expect(streamingTime).toBeLessThan(2000); // Should stream efficiently
        
        options.onComplete?.(longResponse);
        return longResponse;
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Generate a long response');
      await user.click(screen.getByLabelText('Send message'));

      expect(mockStateManager.sendMessageWithStreaming).toHaveBeenCalled();
    });

    it('should handle concurrent audio and text operations', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Start recording
      const recordButton = screen.getByLabelText('Start recording');
      await user.click(recordButton);

      // Simultaneously try to send text message
      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Text while recording');

      // Both operations should be handled
      expect(mockAudioController.startRecording).toHaveBeenCalled();
      expect(input).toHaveValue('Text while recording');

      // Stop recording and send text
      await user.click(screen.getByLabelText('Stop recording'));
      await user.click(screen.getByLabelText('Send message'));

      expect(mockAudioController.stopRecording).toHaveBeenCalled();
      expect(mockStateManager.sendMessage).toHaveBeenCalledWith('Text while recording');
    });
  });

  describe('Error Recovery and Graceful Degradation Scenarios', () => {
    it('should recover from LangChain initialization failures', async () => {
      // Mock initialization failure
      mockLangChainService.initialize.mockRejectedValueOnce(new Error('API key invalid'));
      mockLangChainService.isInitialized.mockReturnValue(false);
      
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        langChainState: {
          ...mockStateManager.getState().langChainState,
          isInitialized: false
        },
        error: 'API key invalid'
      });

      render(<ChatInterface />);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('AI Model Unavailable')).toBeInTheDocument();
        expect(screen.getByText('API key invalid')).toBeInTheDocument();
      });

      // Should provide retry option
      const retryButton = screen.getByText('Try Again');
      
      // Mock successful retry
      mockLangChainService.initialize.mockResolvedValueOnce(undefined);
      mockLangChainService.isInitialized.mockReturnValue(true);
      
      await user.click(retryButton);

      expect(mockStateManager.initializeLangChain).toHaveBeenCalled();
    });

    it('should handle network connectivity issues with retry logic', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Mock network failure
      mockStateManager.sendMessage.mockRejectedValueOnce(new Error('Network error'));
      mockNetworkErrorHandler.executeWithRetry.mockImplementation(async (fn, options) => {
        // Simulate retry logic
        try {
          return await fn();
        } catch (error) {
          if (options?.retryConfig?.maxRetries && options.retryConfig.maxRetries > 0) {
            // Succeed on retry
            return 'Retry successful';
          }
          throw error;
        }
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Test network retry');
      await user.click(screen.getByLabelText('Send message'));

      // Should attempt retry
      expect(mockNetworkErrorHandler.executeWithRetry).toHaveBeenCalled();
    });

    it('should gracefully degrade when audio features fail completely', async () => {
      // Mock complete audio failure
      mockAudioController.getState.mockReturnValue({
        isRecording: false,
        isPlaying: false,
        isPaused: false,
        isSupported: false,
        hasPermission: false,
        error: 'Audio system unavailable'
      });

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        audioState: {
          isRecording: false,
          isPlaying: false,
          isPaused: false,
          isSupported: false,
          hasPermission: false,
          error: 'Audio system unavailable'
        }
      });

      render(<ChatInterface />);

      // Should show audio unavailable but maintain text functionality
      await waitFor(() => {
        expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Audio system unavailable')).toBeInTheDocument();
      });

      // Text interface should still work perfectly
      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByLabelText('Send message');

      expect(input).toBeInTheDocument();
      expect(input).not.toBeDisabled();
      expect(sendButton).toBeInTheDocument();
      expect(sendButton).not.toBeDisabled();

      // Should be able to send text messages
      await user.type(input, 'Text only message');
      await user.click(sendButton);

      expect(mockStateManager.sendMessage).toHaveBeenCalledWith('Text only message');
    });

    it('should handle partial feature failures with appropriate fallbacks', async () => {
      // Mock speech recognition working but TTS failing
      mockAudioController.getState.mockReturnValue({
        isRecording: false,
        isPlaying: false,
        isPaused: false,
        isSupported: true,
        hasPermission: true,
        error: 'Text-to-speech unavailable'
      });

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        audioState: {
          isRecording: false,
          isPlaying: false,
          isPaused: false,
          isSupported: true,
          hasPermission: true,
          error: 'Text-to-speech unavailable'
        },
        messages: [
          {
            id: '1',
            text: 'Test message',
            sender: 'ai',
            timestamp: new Date(),
            status: 'sent'
          }
        ]
      });

      render(<ChatInterface />);

      // Recording should work
      const recordButton = screen.getByLabelText('Start recording');
      expect(recordButton).toBeInTheDocument();
      expect(recordButton).not.toBeDisabled();

      // But audio playback should be disabled/show error
      expect(screen.getByText('Text-to-speech unavailable')).toBeInTheDocument();
    });

    it('should maintain state consistency during error recovery', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Send a message that fails
      mockStateManager.sendMessage.mockRejectedValueOnce(new Error('Temporary failure'));
      
      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Failed message');
      await user.click(screen.getByLabelText('Send message'));

      // Simulate error state
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        error: 'Temporary failure',
        messages: [
          {
            id: '1',
            text: 'Failed message',
            sender: 'user',
            timestamp: new Date(),
            status: 'error'
          }
        ]
      });

      render(<ChatInterface />);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Temporary failure')).toBeInTheDocument();
      });

      // Clear error and retry
      mockStateManager.sendMessage.mockResolvedValueOnce(undefined);
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        error: undefined,
        messages: [
          {
            id: '1',
            text: 'Failed message',
            sender: 'user',
            timestamp: new Date(),
            status: 'sent'
          },
          {
            id: '2',
            text: 'Recovery successful',
            sender: 'ai',
            timestamp: new Date(),
            status: 'sent'
          }
        ]
      });

      // Dismiss error
      const dismissButton = screen.getByLabelText('Dismiss error');
      await user.click(dismissButton);

      expect(mockStateManager.updateError).toHaveBeenCalledWith(undefined);

      // Send new message to verify recovery
      await user.type(input, 'Recovery test');
      await user.click(screen.getByLabelText('Send message'));

      expect(mockStateManager.sendMessage).toHaveBeenCalledWith('Recovery test');
    });

    it('should handle multiple simultaneous errors gracefully', async () => {
      // Mock multiple error conditions
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        error: 'General system error',
        audioState: {
          isRecording: false,
          isPlaying: false,
          isPaused: false,
          isSupported: false,
          hasPermission: false,
          error: 'Audio system failed'
        },
        langChainState: {
          isInitialized: false,
          currentModel: '',
          conversationId: '',
          tokenCount: 0,
          memorySize: 0,
          isStreaming: false
        }
      });

      render(<ChatInterface />);

      // Should show all error states appropriately
      await waitFor(() => {
        expect(screen.getByText('General system error')).toBeInTheDocument();
        expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
        expect(screen.getByText('AI Model Unavailable')).toBeInTheDocument();
      });

      // Should still provide recovery options
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByLabelText('Dismiss error')).toBeInTheDocument();

      // Core text input should remain functional
      const input = screen.getByPlaceholderText('Type your message...');
      expect(input).toBeInTheDocument();
    });
  });
});