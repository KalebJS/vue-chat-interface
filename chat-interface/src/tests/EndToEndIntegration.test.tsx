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

describe('End-to-End Integration Tests', () => {
  let mockLangChainService: any;
  let mockAudioController: any;
  let mockStateManager: any;
  let mockNetworkErrorHandler: any;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Mock LangChain Service with realistic behavior
    mockLangChainService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(true),
      sendMessage: vi.fn().mockImplementation(async (message) => {
        // Simulate realistic AI responses based on input
        if (message.toLowerCase().includes('hello')) {
          return 'Hello! How can I help you today?';
        } else if (message.toLowerCase().includes('weather')) {
          return 'I cannot access real-time weather data, but I can help you with weather-related questions.';
        } else if (message.toLowerCase().includes('code')) {
          return 'I can help you with coding questions. What programming language are you working with?';
        }
        return `I understand you said: "${message}". How can I assist you further?`;
      }),
      sendMessageStreaming: vi.fn().mockImplementation(async (message, options) => {
        const response = `Streaming response to: ${message}`;
        const words = response.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          const token = i === 0 ? words[i] : ' ' + words[i];
          options.onToken?.(token);
          await new Promise(resolve => setTimeout(resolve, 50)); // Realistic streaming delay
        }
        
        options.onComplete?.(response);
        return response;
      }),
      getState: vi.fn().mockReturnValue({
        isInitialized: true,
        currentModel: 'gpt-3.5-turbo',
        conversationId: 'test-conv-123',
        tokenCount: 0,
        memorySize: 0,
        isStreaming: false
      }),
      getConversationHistory: vi.fn().mockResolvedValue([]),
      clearMemory: vi.fn().mockResolvedValue(undefined),
      updateModelConfig: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn()
    };

    // Mock Audio Controller with realistic behavior
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
      startRecording: vi.fn().mockImplementation(async () => {
        // Simulate recording state change
        const stateCallback = mockAudioController.setStateChangeCallback.mock.calls[0]?.[0];
        if (stateCallback) {
          setTimeout(() => {
            stateCallback({
              isRecording: true,
              isPlaying: false,
              isPaused: false,
              isSupported: true,
              hasPermission: true
            });
          }, 100);
        }
      }),
      stopRecording: vi.fn().mockImplementation(async () => {
        // Simulate transcription
        const transcriptionCallback = mockAudioController.setTranscriptionCallback.mock.calls[0]?.[0];
        const stateCallback = mockAudioController.setStateChangeCallback.mock.calls[0]?.[0];
        
        if (stateCallback) {
          stateCallback({
            isRecording: false,
            isPlaying: false,
            isPaused: false,
            isSupported: true,
            hasPermission: true
          });
        }
        
        if (transcriptionCallback) {
          setTimeout(() => {
            transcriptionCallback('Hello, this is a voice message');
          }, 200);
        }
        
        return 'Hello, this is a voice message';
      }),
      speakText: vi.fn().mockImplementation(async (text) => {
        // Simulate TTS playback
        const stateCallback = mockAudioController.setStateChangeCallback.mock.calls[0]?.[0];
        if (stateCallback) {
          stateCallback({
            isRecording: false,
            isPlaying: true,
            isPaused: false,
            isSupported: true,
            hasPermission: true
          });
          
          setTimeout(() => {
            stateCallback({
              isRecording: false,
              isPlaying: false,
              isPaused: false,
              isSupported: true,
              hasPermission: true
            });
          }, 1000);
        }
      }),
      pauseSpeaking: vi.fn(),
      resumeSpeaking: vi.fn(),
      stopSpeaking: vi.fn(),
      recoverFromError: vi.fn().mockResolvedValue(true),
      destroy: vi.fn()
    };

    // Mock State Manager with realistic state management
    let currentState = {
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
        conversationId: 'test-conv-123',
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
    };

    mockStateManager = {
      getState: vi.fn(() => currentState),
      subscribe: vi.fn().mockReturnValue(() => {}),
      sendMessage: vi.fn().mockImplementation(async (message) => {
        // Add user message
        const userMessage = {
          id: `user-${Date.now()}`,
          text: message,
          sender: 'user' as const,
          timestamp: new Date(),
          status: 'sent' as const
        };
        
        currentState.messages.push(userMessage);
        currentState.isLoading = true;
        
        // Get AI response
        const aiResponse = await mockLangChainService.sendMessage(message);
        
        // Add AI message
        const aiMessage = {
          id: `ai-${Date.now()}`,
          text: aiResponse,
          sender: 'ai' as const,
          timestamp: new Date(),
          status: 'sent' as const
        };
        
        currentState.messages.push(aiMessage);
        currentState.isLoading = false;
        
        // Notify subscribers
        const callback = mockStateManager.subscribe.mock.calls[0]?.[0];
        if (callback) {
          callback();
        }
      }),
      sendMessageWithStreaming: vi.fn().mockImplementation(async (message) => {
        // Add user message
        const userMessage = {
          id: `user-${Date.now()}`,
          text: message,
          sender: 'user' as const,
          timestamp: new Date(),
          status: 'sent' as const
        };
        
        currentState.messages.push(userMessage);
        currentState.langChainState.isStreaming = true;
        
        // Create streaming AI message
        const streamingMessage = {
          id: `ai-${Date.now()}`,
          text: '',
          sender: 'ai' as const,
          timestamp: new Date(),
          status: 'sending' as const,
          isStreaming: true
        };
        
        currentState.messages.push(streamingMessage);
        
        // Simulate streaming
        await mockLangChainService.sendMessageStreaming(message, {
          onToken: (token: string) => {
            streamingMessage.text += token;
            const callback = mockStateManager.subscribe.mock.calls[0]?.[0];
            if (callback) {
              callback();
            }
          },
          onComplete: (fullResponse: string) => {
            streamingMessage.text = fullResponse;
            streamingMessage.status = 'sent';
            streamingMessage.isStreaming = false;
            currentState.langChainState.isStreaming = false;
            
            const callback = mockStateManager.subscribe.mock.calls[0]?.[0];
            if (callback) {
              callback();
            }
          }
        });
      }),
      updateCurrentInput: vi.fn((input) => {
        currentState.currentInput = input;
      }),
      updateError: vi.fn((error) => {
        currentState.error = error;
      }),
      updateAudioState: vi.fn((audioState) => {
        currentState.audioState = { ...currentState.audioState, ...audioState };
      }),
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

  describe('Complete Text Conversation Workflows', () => {
    it('should handle a complete multi-turn text conversation', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByLabelText('Send message');

      // First message: Greeting
      await user.type(input, 'Hello there!');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Hello there!')).toBeInTheDocument();
        expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
      });

      // Second message: Ask about weather
      await user.type(input, 'What is the weather like?');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('What is the weather like?')).toBeInTheDocument();
        expect(screen.getByText('I cannot access real-time weather data, but I can help you with weather-related questions.')).toBeInTheDocument();
      });

      // Third message: Ask about coding
      await user.type(input, 'Can you help me with code?');
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Can you help me with code?')).toBeInTheDocument();
        expect(screen.getByText('I can help you with coding questions. What programming language are you working with?')).toBeInTheDocument();
      });

      // Verify conversation history is maintained
      expect(screen.getByText('Hello there!')).toBeInTheDocument();
      expect(screen.getByText('What is the weather like?')).toBeInTheDocument();
      expect(screen.getByText('Can you help me with code?')).toBeInTheDocument();

      // Verify all AI responses are present
      expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
      expect(screen.getByText('I cannot access real-time weather data, but I can help you with weather-related questions.')).toBeInTheDocument();
      expect(screen.getByText('I can help you with coding questions. What programming language are you working with?')).toBeInTheDocument();
    });

    it('should handle keyboard shortcuts and accessibility features', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');

      // Test Enter key to send message
      await user.type(input, 'Test keyboard shortcut');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Test keyboard shortcut')).toBeInTheDocument();
      });

      // Test Tab navigation
      await user.tab();
      expect(screen.getByLabelText('Send message')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Start recording')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/open settings/i)).toHaveFocus();

      // Test Escape key to close modals
      await user.click(screen.getByLabelText(/open settings/i));
      
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      });
    });

    it('should handle message editing and deletion (if implemented)', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');

      // Send a message
      await user.type(input, 'This is a test message');
      await user.click(screen.getByLabelText('Send message'));

      await waitFor(() => {
        expect(screen.getByText('This is a test message')).toBeInTheDocument();
      });

      // Test message context menu (if implemented)
      const userMessage = screen.getByText('This is a test message');
      fireEvent.contextMenu(userMessage);

      // Note: This would test message editing/deletion if implemented
      // For now, we just verify the message is displayed correctly
      expect(userMessage).toBeInTheDocument();
    });
  });

  describe('Complete Audio Interaction Workflows', () => {
    it('should handle complete voice-to-voice conversation cycle', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Start voice recording
      const recordButton = screen.getByLabelText('Start recording');
      await user.click(recordButton);

      expect(mockAudioController.startRecording).toHaveBeenCalled();

      // Wait for recording state to update
      await waitFor(() => {
        expect(screen.getByLabelText('Recording in progress')).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = screen.getByLabelText('Stop recording');
      await user.click(stopButton);

      expect(mockAudioController.stopRecording).toHaveBeenCalled();

      // Wait for transcription and message to be sent
      await waitFor(() => {
        expect(screen.getByText('Hello, this is a voice message')).toBeInTheDocument();
      });

      // Wait for AI response
      await waitFor(() => {
        expect(screen.getByText(/I understand you said: "Hello, this is a voice message"/)).toBeInTheDocument();
      });

      // Test text-to-speech playback
      const playButtons = screen.getAllByLabelText('Play audio');
      const aiMessagePlayButton = playButtons.find(button => 
        button.closest('.message-item')?.textContent?.includes('I understand you said')
      );

      if (aiMessagePlayButton) {
        await user.click(aiMessagePlayButton);
        expect(mockAudioController.speakText).toHaveBeenCalledWith(
          expect.stringContaining('I understand you said: "Hello, this is a voice message"')
        );

        // Wait for playback to start
        await waitFor(() => {
          expect(screen.getByLabelText('Pause audio')).toBeInTheDocument();
        });

        // Test pause functionality
        const pauseButton = screen.getByLabelText('Pause audio');
        await user.click(pauseButton);
        expect(mockAudioController.pauseSpeaking).toHaveBeenCalled();
      }
    });

    it('should handle mixed text and voice interactions', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Start with text message
      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello, I am typing this message');
      await user.click(screen.getByLabelText('Send message'));

      await waitFor(() => {
        expect(screen.getByText('Hello, I am typing this message')).toBeInTheDocument();
      });

      // Follow up with voice message
      const recordButton = screen.getByLabelText('Start recording');
      await user.click(recordButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Recording in progress')).toBeInTheDocument();
      });

      const stopButton = screen.getByLabelText('Stop recording');
      await user.click(stopButton);

      await waitFor(() => {
        expect(screen.getByText('Hello, this is a voice message')).toBeInTheDocument();
      });

      // Verify both messages are in conversation
      expect(screen.getByText('Hello, I am typing this message')).toBeInTheDocument();
      expect(screen.getByText('Hello, this is a voice message')).toBeInTheDocument();

      // Both should have AI responses
      await waitFor(() => {
        expect(screen.getAllByText(/I understand you said/)).toHaveLength(2);
      });
    });

    it('should handle audio permission flow', async () => {
      // Mock permission denied initially
      mockAudioController.getState.mockReturnValue({
        isRecording: false,
        isPlaying: false,
        isPaused: false,
        isSupported: true,
        hasPermission: false,
        error: 'Microphone permission denied'
      });

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Microphone permission denied')).toBeInTheDocument();
      });

      // Test permission request
      const retryButton = screen.getByText('Try Again');
      
      // Mock permission granted after retry
      mockAudioController.recoverFromError.mockImplementation(async () => {
        mockAudioController.getState.mockReturnValue({
          isRecording: false,
          isPlaying: false,
          isPaused: false,
          isSupported: true,
          hasPermission: true,
          error: undefined
        });
        return true;
      });

      await user.click(retryButton);

      expect(mockAudioController.recoverFromError).toHaveBeenCalled();

      // After permission granted, audio features should be available
      await waitFor(() => {
        expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
      });
    });
  });

  describe('Settings and Configuration Workflows', () => {
    it('should handle complete settings configuration workflow', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Open settings
      const settingsButton = screen.getByLabelText(/open settings/i);
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Test General settings
      const autoScrollCheckbox = screen.getByLabelText(/auto-scroll/i);
      await user.click(autoScrollCheckbox);

      const audioEnabledCheckbox = screen.getByLabelText(/enable audio/i);
      await user.click(audioEnabledCheckbox);

      // Test Voice settings
      const voiceSelect = screen.getByLabelText(/voice/i);
      await user.selectOptions(voiceSelect, 'Test Voice 1');

      const rateSlider = screen.getByLabelText(/speech rate/i);
      await user.clear(rateSlider);
      await user.type(rateSlider, '1.5');

      const pitchSlider = screen.getByLabelText(/speech pitch/i);
      await user.clear(pitchSlider);
      await user.type(pitchSlider, '1.2');

      // Test AI Model settings
      const providerSelect = screen.getByLabelText(/provider/i);
      await user.selectOptions(providerSelect, 'anthropic');

      const modelNameInput = screen.getByLabelText(/model name/i);
      await user.clear(modelNameInput);
      await user.type(modelNameInput, 'claude-3-sonnet');

      const temperatureSlider = screen.getByLabelText(/temperature/i);
      await user.clear(temperatureSlider);
      await user.type(temperatureSlider, '0.8');

      const maxTokensInput = screen.getByLabelText(/max tokens/i);
      await user.clear(maxTokensInput);
      await user.type(maxTokensInput, '2000');

      // Save settings
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Verify settings were applied
      expect(mockLangChainService.updateModelConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          modelName: 'claude-3-sonnet',
          temperature: 0.8,
          maxTokens: 2000
        })
      );

      // Settings panel should close
      await waitFor(() => {
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      });

      // Test that settings persist by reopening
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Verify settings are still applied
      expect(screen.getByDisplayValue('claude-3-sonnet')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.8')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    });

    it('should handle settings validation and error handling', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Open settings
      const settingsButton = screen.getByLabelText(/open settings/i);
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Enter invalid values
      const temperatureSlider = screen.getByLabelText(/temperature/i);
      await user.clear(temperatureSlider);
      await user.type(temperatureSlider, '5'); // Invalid: > 2

      const maxTokensInput = screen.getByLabelText(/max tokens/i);
      await user.clear(maxTokensInput);
      await user.type(maxTokensInput, '-100'); // Invalid: negative

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/temperature must be between/i)).toBeInTheDocument();
        expect(screen.getByText(/max tokens must be positive/i)).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).toBeDisabled();

      // Fix validation errors
      await user.clear(temperatureSlider);
      await user.type(temperatureSlider, '0.7');

      await user.clear(maxTokensInput);
      await user.type(maxTokensInput, '1000');

      // Validation errors should disappear
      await waitFor(() => {
        expect(screen.queryByText(/temperature must be between/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/max tokens must be positive/i)).not.toBeInTheDocument();
      });

      // Save button should be enabled
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Streaming Response Workflows', () => {
    it('should handle complete streaming conversation workflow', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');

      // Send message that triggers streaming
      await user.type(input, 'Tell me a long story');
      await user.click(screen.getByLabelText('Send message'));

      // Should show user message immediately
      await waitFor(() => {
        expect(screen.getByText('Tell me a long story')).toBeInTheDocument();
      });

      // Should show streaming indicator
      await waitFor(() => {
        expect(screen.getByLabelText('AI is typing')).toBeInTheDocument();
      });

      // Should show partial response as it streams
      await waitFor(() => {
        expect(screen.getByText(/Streaming response/)).toBeInTheDocument();
      });

      // Should show complete response when streaming finishes
      await waitFor(() => {
        expect(screen.getByText('Streaming response to: Tell me a long story')).toBeInTheDocument();
        expect(screen.queryByLabelText('AI is typing')).not.toBeInTheDocument();
      });

      // Should be able to interact with the completed message
      const playButtons = screen.getAllByLabelText('Play audio');
      const streamedMessagePlayButton = playButtons.find(button => 
        button.closest('.message-item')?.textContent?.includes('Streaming response to: Tell me a long story')
      );

      if (streamedMessagePlayButton) {
        await user.click(streamedMessagePlayButton);
        expect(mockAudioController.speakText).toHaveBeenCalledWith('Streaming response to: Tell me a long story');
      }
    });

    it('should handle streaming interruption and recovery', async () => {
      // Mock streaming that fails midway
      mockLangChainService.sendMessageStreaming.mockImplementation(async (message, options) => {
        const partialResponse = 'This is a partial';
        const words = partialResponse.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          const token = i === 0 ? words[i] : ' ' + words[i];
          options.onToken?.(token);
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Simulate error after partial response
          if (i === 2) {
            throw new Error('Streaming interrupted');
          }
        }
      });

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Stream with interruption');
      await user.click(screen.getByLabelText('Send message'));

      // Should show partial response before error
      await waitFor(() => {
        expect(screen.getByText(/This is a/)).toBeInTheDocument();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Streaming interrupted/)).toBeInTheDocument();
      });

      // Should provide retry option
      const retryButton = screen.getByText('Try Again');
      
      // Mock successful retry
      mockLangChainService.sendMessage.mockResolvedValueOnce('Retry successful response');
      
      await user.click(retryButton);

      // Should show successful response after retry
      await waitFor(() => {
        expect(screen.getByText('Retry successful response')).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle complete error recovery workflow', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Simulate network error
      mockStateManager.sendMessage.mockRejectedValueOnce(new Error('Network connection failed'));

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'This will fail');
      await user.click(screen.getByLabelText('Send message'));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Network connection failed')).toBeInTheDocument();
      });

      // Should show retry option
      const retryButton = screen.getByText('Try Again');
      
      // Mock successful retry
      mockStateManager.sendMessage.mockResolvedValueOnce(undefined);
      
      await user.click(retryButton);

      // Error should be cleared and message should be sent successfully
      await waitFor(() => {
        expect(screen.queryByText('Network connection failed')).not.toBeInTheDocument();
        expect(screen.getByText('This will fail')).toBeInTheDocument();
      });

      // Should be able to continue conversation normally
      await user.type(input, 'Follow up message');
      await user.click(screen.getByLabelText('Send message'));

      await waitFor(() => {
        expect(screen.getByText('Follow up message')).toBeInTheDocument();
      });
    });

    it('should handle multiple simultaneous errors and recovery', async () => {
      // Mock multiple error conditions
      mockAudioController.getState.mockReturnValue({
        isRecording: false,
        isPlaying: false,
        isPaused: false,
        isSupported: false,
        hasPermission: false,
        error: 'Audio system failed'
      });

      mockLangChainService.isInitialized.mockReturnValue(false);
      mockLangChainService.initialize.mockRejectedValueOnce(new Error('AI model initialization failed'));

      render(<ChatInterface />);

      // Should show multiple error states
      await waitFor(() => {
        expect(screen.getByText('Audio Unavailable')).toBeInTheDocument();
        expect(screen.getByText('AI Model Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Audio system failed')).toBeInTheDocument();
        expect(screen.getByText('AI model initialization failed')).toBeInTheDocument();
      });

      // Should provide recovery options for each error
      const retryButtons = screen.getAllByText('Try Again');
      expect(retryButtons.length).toBeGreaterThan(0);

      // Mock successful recovery
      mockLangChainService.initialize.mockResolvedValueOnce(undefined);
      mockLangChainService.isInitialized.mockReturnValue(true);
      mockAudioController.recoverFromError.mockResolvedValueOnce(true);
      mockAudioController.getState.mockReturnValue({
        isRecording: false,
        isPlaying: false,
        isPaused: false,
        isSupported: true,
        hasPermission: true,
        error: undefined
      });

      // Retry AI model initialization
      const aiRetryButton = retryButtons[0];
      await user.click(aiRetryButton);

      // Should recover from errors
      await waitFor(() => {
        expect(screen.queryByText('AI Model Unavailable')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
      });

      // Should be able to use all features normally
      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Recovery test');
      await user.click(screen.getByLabelText('Send message'));

      await waitFor(() => {
        expect(screen.getByText('Recovery test')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Stress Test Workflows', () => {
    it('should handle rapid user interactions without breaking', async () => {
      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByLabelText('Send message');

      // Rapid message sending
      for (let i = 0; i < 10; i++) {
        await user.clear(input);
        await user.type(input, `Rapid message ${i}`);
        await user.click(sendButton);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should handle all messages
      await waitFor(() => {
        expect(screen.getByText('Rapid message 9')).toBeInTheDocument();
      });

      // Interface should remain responsive
      const settingsButton = screen.getByLabelText(/open settings/i);
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should maintain functionality with long conversation history', async () => {
      // Pre-populate with long conversation history
      const longHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        text: `Historical message ${i}`,
        sender: i % 2 === 0 ? 'user' : 'ai' as const,
        timestamp: new Date(Date.now() - (100 - i) * 60000),
        status: 'sent' as const
      }));

      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        messages: longHistory
      });

      render(<ChatInterface />);

      await waitFor(() => {
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
      });

      // Should show recent messages
      expect(screen.getByText('Historical message 99')).toBeInTheDocument();

      // Should still be able to send new messages
      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'New message after long history');
      await user.click(screen.getByLabelText('Send message'));

      await waitFor(() => {
        expect(screen.getByText('New message after long history')).toBeInTheDocument();
      });

      // Should maintain scroll position appropriately
      const messageList = screen.getByRole('log');
      expect(messageList.scrollTop).toBeGreaterThan(0);
    });
  });
});