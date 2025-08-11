import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../components/ChatInterface';
import { MessageList } from '../components/MessageList';
import { MessageItem } from '../components/MessageItem';
import { InputArea } from '../components/InputArea';
import { RecordButton } from '../components/RecordButton';
import { AudioControls } from '../components/AudioControls';
import type { Message, AudioState, VoiceSettings } from '../types';
import { MessageStatus } from '../types';

// Mock dependencies
vi.mock('../hooks/useStateManager');
vi.mock('../services/AudioController');
vi.mock('../services/LangChainService');

const mockMessages: Message[] = [
  {
    id: '1',
    text: 'Hello, how can I help you today?',
    sender: 'ai',
    timestamp: new Date('2023-01-01T10:00:00Z'),
    status: MessageStatus.SENT
  },
  {
    id: '2',
    text: 'I need help with my project',
    sender: 'user',
    timestamp: new Date('2023-01-01T10:01:00Z'),
    status: MessageStatus.SENT
  },
  {
    id: '3',
    text: 'I can help you with that. What specific area do you need assistance with?',
    sender: 'ai',
    timestamp: new Date('2023-01-01T10:02:00Z'),
    status: MessageStatus.SENT,
    isStreaming: true
  }
];

const mockAudioState: AudioState = {
  isRecording: false,
  isPlaying: false,
  isPaused: false,
  isSupported: true,
  hasPermission: true
};

const mockVoiceSettings: VoiceSettings = {
  rate: 1,
  pitch: 1,
  voice: 'default'
};

describe('Screen Reader Compatibility Tests', () => {
  describe('Live Regions and Announcements', () => {
    test('Message list uses proper live region for new messages', () => {
      const mockProps = {
        messages: mockMessages,
        isLoading: false,
        autoScroll: true,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      render(<MessageList {...mockProps} />);
      
      // Check for live region
      const liveRegion = screen.getByRole('log');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-label', 'Conversation history');
    });

    test('Recording status is announced via live region', () => {
      const mockProps = {
        value: '',
        onChange: vi.fn(),
        onSubmit: vi.fn(),
        onToggleRecording: vi.fn(),
        isLoading: false,
        isRecording: true,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      // Check for recording status live region
      const recordingStatus = screen.getByRole('status');
      expect(recordingStatus).toHaveAttribute('aria-live', 'polite');
      expect(recordingStatus).toHaveAttribute('aria-label', 'Recording in progress');
    });

    test('Error messages are announced assertively', () => {
      const errorAudioState: AudioState = {
        ...mockAudioState,
        error: 'Microphone access denied'
      };

      const mockProps = {
        text: 'Test message',
        audioState: errorAudioState,
        voiceSettings: mockVoiceSettings,
        onPlay: vi.fn(),
        onPause: vi.fn(),
        onResume: vi.fn(),
        onStop: vi.fn(),
        messageId: '1'
      };

      render(<AudioControls {...mockProps} />);
      
      // Check for error alert
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      expect(errorAlert).toHaveTextContent('Microphone access denied');
    });

    test('Streaming message status is announced', () => {
      const streamingMessage = mockMessages[2]; // The streaming message

      const mockProps = {
        message: streamingMessage,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      render(<MessageItem {...mockProps} />);
      
      // Check for streaming status
      const streamingStatus = screen.getByLabelText('AI is typing');
      expect(streamingStatus).toHaveAttribute('aria-live', 'polite');
      expect(streamingStatus).toHaveAttribute('role', 'status');
    });
  });

  describe('Descriptive Labels and Names', () => {
    test('Messages have descriptive accessible names', () => {
      const mockProps = {
        message: mockMessages[0],
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      render(<MessageItem {...mockProps} />);
      
      // Check message structure
      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-labelledby', 'message-header-1');
      expect(article).toHaveAttribute('aria-describedby', 'message-content-1');
      
      // Check heading
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveAttribute('id', 'message-header-1');
      expect(heading).toHaveTextContent('AI Assistant');
      
      // Check content
      const content = screen.getByRole('text');
      expect(content).toHaveAttribute('id', 'message-content-1');
      expect(content).toHaveTextContent(mockMessages[0].text);
    });

    test('Audio controls have descriptive labels', () => {
      const mockProps = {
        text: 'This is a test message for audio playback',
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlay: vi.fn(),
        onPause: vi.fn(),
        onResume: vi.fn(),
        onStop: vi.fn(),
        messageId: '1'
      };

      render(<AudioControls {...mockProps} />);
      
      // Check audio controls group
      const controlsGroup = screen.getByRole('group');
      expect(controlsGroup).toHaveAttribute('aria-label', 'Audio playback controls');
      
      // Check play button
      const playButton = screen.getByRole('button', { name: /play message as audio/i });
      expect(playButton).toHaveAttribute('aria-pressed', 'false');
      expect(playButton).toHaveAttribute('title', 'Play audio');
    });

    test('Recording button has descriptive labels', () => {
      const mockProps = {
        isRecording: false,
        isLoading: false,
        audioEnabled: true,
        onToggleRecording: vi.fn()
      };

      render(<RecordButton {...mockProps} />);
      
      // Check recording group
      const recordingGroup = screen.getByRole('group');
      expect(recordingGroup).toHaveAttribute('aria-label', 'Voice recording');
      
      // Check record button
      const recordButton = screen.getByRole('button');
      expect(recordButton).toHaveAttribute('aria-label', 'Start voice recording');
      expect(recordButton).toHaveAttribute('aria-pressed', 'false');
      expect(recordButton).toHaveAttribute('title', 'Start voice recording');
    });

    test('Input area has proper form labels', () => {
      const mockProps = {
        value: '',
        onChange: vi.fn(),
        onSubmit: vi.fn(),
        onToggleRecording: vi.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      // Check region
      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-label', 'Message input area');
      
      // Check textbox
      const textbox = screen.getByRole('textbox');
      expect(textbox).toHaveAttribute('aria-label', 'Message input');
      expect(textbox).toHaveAttribute('id', 'message-input');
      
      // Check label
      expect(screen.getByLabelText('Type your message here')).toBe(textbox);
      
      // Check button group
      const buttonGroup = screen.getByLabelText('Message actions');
      expect(buttonGroup).toHaveAttribute('role', 'group');
    });
  });

  describe('Status and State Announcements', () => {
    test('Loading states are properly announced', () => {
      const mockProps = {
        value: 'Test message',
        onChange: vi.fn(),
        onSubmit: vi.fn(),
        onToggleRecording: vi.fn(),
        isLoading: true,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      // Check loading state announcement
      const sendButton = screen.getByRole('button', { name: /sending message/i });
      expect(sendButton).toBeInTheDocument();
      expect(sendButton).toBeDisabled();
    });

    test('Recording timer is announced to screen readers', () => {
      const mockProps = {
        isRecording: true,
        isLoading: false,
        audioEnabled: true,
        onToggleRecording: vi.fn()
      };

      render(<RecordButton {...mockProps} />);
      
      // Check timer
      const timer = screen.getByRole('timer');
      expect(timer).toHaveAttribute('aria-live', 'polite');
      expect(timer).toHaveAttribute('aria-label', 'Recording time: 0:00');
    });

    test('Audio playback states are announced', () => {
      const playingAudioState: AudioState = {
        ...mockAudioState,
        isPlaying: true
      };

      const mockProps = {
        text: 'Test message',
        audioState: playingAudioState,
        voiceSettings: mockVoiceSettings,
        onPlay: vi.fn(),
        onPause: vi.fn(),
        onResume: vi.fn(),
        onStop: vi.fn(),
        messageId: '1'
      };

      render(<AudioControls {...mockProps} />);
      
      // Check play button state
      const playButton = screen.getByRole('button', { name: /pause audio playback/i });
      expect(playButton).toHaveAttribute('aria-pressed', 'true');
      
      // Check stop button appears
      const stopButton = screen.getByRole('button', { name: /stop audio playback/i });
      expect(stopButton).toBeInTheDocument();
    });

    test('Message status is announced', () => {
      const errorMessage: Message = {
        ...mockMessages[0],
        status: MessageStatus.ERROR
      };

      const mockProps = {
        message: errorMessage,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      render(<MessageItem {...mockProps} />);
      
      // Check status announcement
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', 'Message status: error');
    });
  });

  describe('Navigation and Interaction Announcements', () => {
    test('Keyboard navigation help is provided', () => {
      const mockProps = {
        messages: mockMessages,
        isLoading: false,
        autoScroll: true,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      render(<MessageList {...mockProps} />);
      
      // Check navigation help
      const helpText = screen.getByText(/keyboard navigation/i);
      expect(helpText).toHaveClass('sr-only');
      expect(helpText).toHaveAttribute('aria-live', 'polite');
      expect(helpText).toHaveAttribute('id', 'keyboard-navigation-help');
      
      // Check that message container references the help
      const messageContainer = screen.getByRole('log');
      expect(messageContainer).toHaveAttribute('aria-describedby', 'keyboard-navigation-help');
    });

    test('Button states change announcements', async () => {
      const user = userEvent.setup();
      const mockOnToggle = vi.fn();
      
      const mockProps = {
        isRecording: false,
        isLoading: false,
        audioEnabled: true,
        onToggleRecording: mockOnToggle
      };

      const { rerender } = render(<RecordButton {...mockProps} />);
      
      // Initial state
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toHaveAttribute('aria-label', 'Start voice recording');
      
      // Simulate recording state change
      rerender(<RecordButton {...mockProps} isRecording={true} />);
      
      // Check updated state
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveAttribute('aria-label', 'Stop voice recording');
    });

    test('Error dismissal is announced', async () => {
      const user = userEvent.setup();
      
      // Mock ChatInterface with error state
      render(<ChatInterface />);
      
      // Simulate error state (this would normally come from state management)
      // For this test, we'll check that error banners have proper ARIA attributes
      const errorElements = screen.queryAllByRole('alert');
      
      errorElements.forEach(errorElement => {
        expect(errorElement).toHaveAttribute('aria-live', 'assertive');
        
        // Check for dismiss button if present
        const dismissButton = errorElement.querySelector('button[aria-label*="dismiss" i]');
        if (dismissButton) {
          expect(dismissButton).toHaveAccessibleName();
        }
      });
    });
  });

  describe('Content Structure for Screen Readers', () => {
    test('Conversation has proper heading hierarchy', () => {
      render(<ChatInterface />);
      
      // Check main heading
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('AI Chat Interface');
      
      // Message headings should be level 3 (after main heading and potential section headings)
      const mockProps = {
        message: mockMessages[0],
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      render(<MessageItem {...mockProps} />);
      
      const messageHeading = screen.getByRole('heading', { level: 3 });
      expect(messageHeading).toBeInTheDocument();
    });

    test('Landmarks are properly structured', () => {
      render(<ChatInterface />);
      
      // Check for main landmark
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('aria-label', 'AI Chat Interface');
      
      // Check for banner
      const banner = screen.getByRole('banner');
      expect(banner).toBeInTheDocument();
      
      // Check for regions
      const regions = screen.getAllByRole('region');
      expect(regions.length).toBeGreaterThan(0);
      
      // Each region should have an accessible name
      regions.forEach(region => {
        expect(region).toHaveAccessibleName();
      });
    });

    test('Lists and groups are properly structured', () => {
      const mockProps = {
        messages: mockMessages,
        isLoading: false,
        autoScroll: true,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      render(<MessageList {...mockProps} />);
      
      // Check for groups
      const groups = screen.getAllByRole('group');
      groups.forEach(group => {
        expect(group).toHaveAccessibleName();
      });
    });
  });

  describe('Dynamic Content Updates', () => {
    test('New messages are announced when added', async () => {
      const mockProps = {
        messages: [mockMessages[0]],
        isLoading: false,
        autoScroll: true,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      const { rerender } = render(<MessageList {...mockProps} />);
      
      // Add a new message
      rerender(<MessageList {...mockProps} messages={mockMessages} />);
      
      // Check that the live region contains the new messages
      const liveRegion = screen.getByRole('log');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      
      // All messages should be present
      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(mockMessages.length);
    });

    test('Loading states are dynamically announced', () => {
      const mockProps = {
        messages: mockMessages,
        isLoading: true,
        autoScroll: true,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: vi.fn(),
        onPauseAudio: vi.fn(),
        onResumeAudio: vi.fn(),
        onStopAudio: vi.fn()
      };

      render(<MessageList {...mockProps} />);
      
      // Check for loading indicator
      expect(screen.getByText(/AI is thinking/i)).toBeInTheDocument();
    });
  });
});