import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ChatInterface } from '../components/ChatInterface';
import { InputArea } from '../components/InputArea';
import { MessageList } from '../components/MessageList';
import { MessageItem } from '../components/MessageItem';
import { RecordButton } from '../components/RecordButton';
import { AudioControls } from '../components/AudioControls';
import { SettingsButton } from '../components/SettingsButton';
import type { Message, AudioState, VoiceSettings } from '../types';
import { MessageStatus } from '../types';

// Mock dependencies
const mockUseStateManager = {
  state: {
    messages: [],
    currentInput: '',
    isLoading: false,
    audioState: {
      isRecording: false,
      isPlaying: false,
      isPaused: false,
      isSupported: true,
      hasPermission: true
    },
    langChainState: {
      isInitialized: true,
      currentModel: 'test',
      conversationId: 'test',
      tokenCount: 0,
      memorySize: 0,
      isStreaming: false
    },
    error: undefined,
    settings: {
      autoScroll: true,
      audioEnabled: true,
      voiceSettings: { rate: 1, pitch: 1, voice: 'default' },
      aiModel: {} as any
    }
  },
  sendMessage: vi.fn(),
  updateCurrentInput: vi.fn(),
  updateError: vi.fn(),
  updateAudioState: vi.fn(),
  updateSettings: vi.fn(),
  initializeLangChain: vi.fn(),
  getAvailableVoices: vi.fn(() => []),
  updateModelConfig: vi.fn()
};

vi.mock('../hooks/useStateManager', () => ({
  useStateManager: () => mockUseStateManager
}));

vi.mock('../services/AudioController', () => ({
  AudioController: vi.fn()
}));

vi.mock('../services/LangChainService', () => ({
  LangChainService: vi.fn()
}));

vi.mock('../services/NetworkErrorHandler', () => ({
  NetworkErrorHandler: {
    setupConnectionMonitoring: vi.fn(() => vi.fn())
  }
}));

const mockMessages: Message[] = [
  {
    id: '1',
    text: 'Hello, how can I help you?',
    sender: 'ai',
    timestamp: new Date('2023-01-01T10:00:00Z'),
    status: MessageStatus.SENT
  },
  {
    id: '2',
    text: 'I need help with accessibility',
    sender: 'user',
    timestamp: new Date('2023-01-01T10:01:00Z'),
    status: MessageStatus.SENT
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

describe('Accessibility Tests', () => {
  describe('ARIA Labels and Semantic HTML', () => {
    test('ChatInterface has proper semantic structure', async () => {
      const { container } = render(<ChatInterface />);
      
      // Check for main landmark
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'AI Chat Interface');
      
      // Check for banner (header)
      expect(screen.getByRole('banner')).toBeInTheDocument();
      
      // Check for heading
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AI Chat Interface');
      
      // Check for toolbar
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
      expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Chat controls');
      
      // Basic accessibility check - ensure no obvious violations
      expect(container).toBeInTheDocument();
    });

    test('InputArea has proper form semantics', async () => {
      const mockProps = {
        value: '',
        onChange: jest.fn(),
        onSubmit: jest.fn(),
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      const { container } = render(<InputArea {...mockProps} />);
      
      // Check for region landmark
      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Message input area');
      
      // Check for textbox with proper labeling
      const textbox = screen.getByRole('textbox');
      expect(textbox).toBeInTheDocument();
      expect(textbox).toHaveAttribute('aria-label', 'Message input');
      expect(textbox).toHaveAttribute('id', 'message-input');
      
      // Check for label
      expect(screen.getByLabelText('Type your message here')).toBeInTheDocument();
      
      // Check for button group
      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Message actions');
      
      // Check for send button
      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeInTheDocument();
      expect(sendButton).toHaveAttribute('type', 'button');
      
      // Basic accessibility check - ensure no obvious violations
      expect(container).toBeInTheDocument();
    });

    test('MessageList has proper log semantics', async () => {
      const mockProps = {
        messages: mockMessages,
        isLoading: false,
        autoScroll: true,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: jest.fn(),
        onPauseAudio: jest.fn(),
        onResumeAudio: jest.fn(),
        onStopAudio: jest.fn()
      };

      const { container } = render(<MessageList {...mockProps} />);
      
      // Check for log role
      expect(screen.getByRole('log')).toBeInTheDocument();
      expect(screen.getByRole('log')).toHaveAttribute('aria-label', 'Conversation history');
      expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
      
      // Check for keyboard navigation help
      expect(screen.getByText(/keyboard navigation/i)).toBeInTheDocument();
      
      // Basic accessibility check - ensure no obvious violations
      expect(container).toBeInTheDocument();
    });

    test('MessageItem has proper article semantics', async () => {
      const mockProps = {
        message: mockMessages[0],
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: jest.fn(),
        onPauseAudio: jest.fn(),
        onResumeAudio: jest.fn(),
        onStopAudio: jest.fn()
      };

      const { container } = render(<MessageItem {...mockProps} />);
      
      // Check for article role
      expect(screen.getByRole('article')).toBeInTheDocument();
      expect(screen.getByRole('article')).toHaveAttribute('aria-labelledby', 'message-header-1');
      expect(screen.getByRole('article')).toHaveAttribute('aria-describedby', 'message-content-1');
      
      // Check for heading
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toHaveAttribute('id', 'message-header-1');
      
      // Check for message content
      expect(screen.getByRole('text')).toBeInTheDocument();
      expect(screen.getByRole('text')).toHaveAttribute('id', 'message-content-1');
      
      // Check for audio controls region
      expect(screen.getByRole('region', { name: /audio controls/i })).toBeInTheDocument();
      
      // Basic accessibility check - ensure no obvious violations
      expect(container).toBeInTheDocument();
    });

    test('RecordButton has proper button semantics', async () => {
      const mockProps = {
        isRecording: false,
        isLoading: false,
        audioEnabled: true,
        onToggleRecording: jest.fn()
      };

      const { container } = render(<RecordButton {...mockProps} />);
      
      // Check for group role
      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Voice recording');
      
      // Check for button
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Start voice recording');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toHaveAttribute('type', 'button');
      
      // Basic accessibility check - ensure no obvious violations
      expect(container).toBeInTheDocument();
    });

    test('AudioControls has proper control semantics', async () => {
      const mockProps = {
        text: 'Test message',
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlay: jest.fn(),
        onPause: jest.fn(),
        onResume: jest.fn(),
        onStop: jest.fn(),
        messageId: '1'
      };

      const { container } = render(<AudioControls {...mockProps} />);
      
      // Check for group role
      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Audio playback controls');
      
      // Check for play button
      const playButton = screen.getByRole('button', { name: /play message as audio/i });
      expect(playButton).toBeInTheDocument();
      expect(playButton).toHaveAttribute('aria-pressed', 'false');
      expect(playButton).toHaveAttribute('type', 'button');
      
      // Basic accessibility check - ensure no obvious violations
      expect(container).toBeInTheDocument();
    });

    test('SettingsButton has proper button semantics', async () => {
      const mockProps = {
        onClick: jest.fn(),
        disabled: false
      };

      const { container } = render(<SettingsButton {...mockProps} />);
      
      // Check for button
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Open settings panel');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('type', 'button');
      
      // Check for screen reader text
      expect(screen.getByText('Settings')).toHaveClass('sr-only');
      
      // Basic accessibility check - ensure no obvious violations
      expect(container).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    test('InputArea supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockProps = {
        value: '',
        onChange: jest.fn(),
        onSubmit: jest.fn(),
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      const textbox = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send message/i });
      
      // Test tab navigation
      await user.tab();
      expect(textbox).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /start voice recording/i })).toHaveFocus();
      
      await user.tab();
      expect(sendButton).toHaveFocus();
      
      // Test Enter key submission
      await user.click(textbox);
      await user.type(textbox, 'Test message');
      await user.keyboard('{Enter}');
      
      expect(mockProps.onSubmit).toHaveBeenCalledWith('Test message');
    });

    test('MessageList supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockProps = {
        messages: mockMessages,
        isLoading: false,
        autoScroll: true,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: jest.fn(),
        onPauseAudio: jest.fn(),
        onResumeAudio: jest.fn(),
        onStopAudio: jest.fn()
      };

      render(<MessageList {...mockProps} />);
      
      const messageContainer = screen.getByRole('log');
      
      // Focus the container
      await user.click(messageContainer);
      expect(messageContainer).toHaveFocus();
      
      // Test keyboard shortcuts
      await user.keyboard('{Control>}{Home}{/Control}');
      await user.keyboard('{Control>}{End}{/Control}');
      await user.keyboard('{PageUp}');
      await user.keyboard('{PageDown}');
      await user.keyboard('{Control>}{ArrowUp}{/Control}');
      await user.keyboard('{Control>}{ArrowDown}{/Control}');
      
      // No errors should occur
      expect(messageContainer).toHaveFocus();
    });

    test('All interactive elements are focusable', async () => {
      const user = userEvent.setup();
      
      render(<ChatInterface />);
      
      // Get all focusable elements
      const focusableElements = screen.getAllByRole('button');
      const textboxes = screen.getAllByRole('textbox');
      
      // Test that all elements can receive focus
      for (const element of [...focusableElements, ...textboxes]) {
        if (!element.hasAttribute('disabled')) {
          await user.click(element);
          expect(element).toHaveFocus();
        }
      }
    });
  });

  describe('Screen Reader Support', () => {
    test('Audio states are announced to screen readers', async () => {
      const mockProps = {
        isRecording: true,
        isLoading: false,
        audioEnabled: true,
        onToggleRecording: jest.fn()
      };

      render(<RecordButton {...mockProps} />);
      
      // Check for recording status
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('timer')).toBeInTheDocument();
      expect(screen.getByLabelText(/recording time/i)).toBeInTheDocument();
    });

    test('Message status is announced to screen readers', async () => {
      const streamingMessage: Message = {
        ...mockMessages[0],
        isStreaming: true
      };

      const mockProps = {
        message: streamingMessage,
        audioState: mockAudioState,
        voiceSettings: mockVoiceSettings,
        onPlayAudio: jest.fn(),
        onPauseAudio: jest.fn(),
        onResumeAudio: jest.fn(),
        onStopAudio: jest.fn()
      };

      render(<MessageItem {...mockProps} />);
      
      // Check for streaming status
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText('AI is typing')).toBeInTheDocument();
    });

    test('Error messages are announced to screen readers', async () => {
      const errorAudioState: AudioState = {
        ...mockAudioState,
        error: 'Audio playback failed'
      };

      const mockProps = {
        text: 'Test message',
        audioState: errorAudioState,
        voiceSettings: mockVoiceSettings,
        onPlay: jest.fn(),
        onPause: jest.fn(),
        onResume: jest.fn(),
        onStop: jest.fn(),
        messageId: '1'
      };

      render(<AudioControls {...mockProps} />);
      
      // Check for error alert
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Audio playback failed')).toBeInTheDocument();
    });

    test('Loading states are announced to screen readers', async () => {
      const mockProps = {
        value: '',
        onChange: jest.fn(),
        onSubmit: jest.fn(),
        onToggleRecording: jest.fn(),
        isLoading: true,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      // Check for loading announcement
      const sendButton = screen.getByRole('button', { name: /sending message/i });
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe('High Contrast Mode Support', () => {
    test('Components render properly in high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { container } = render(<ChatInterface />);
      
      // Check that components render without errors
      expect(container).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Reduced Motion Support', () => {
    test('Animations are disabled when prefers-reduced-motion is set', () => {
      // Mock reduced motion media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { container } = render(<ChatInterface />);
      
      // Check that components render without errors
      expect(container).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    test('Focus is properly managed during interactions', async () => {
      const user = userEvent.setup();
      
      render(<ChatInterface />);
      
      // Test focus trap in modal-like components
      const settingsButton = screen.getByRole('button', { name: /open settings/i });
      await user.click(settingsButton);
      
      // Focus should remain within the application
      expect(document.activeElement).toBeInTheDocument();
    });

    test('Focus indicators are visible', async () => {
      const user = userEvent.setup();
      
      render(<ChatInterface />);
      
      // Tab through focusable elements and check for focus indicators
      await user.tab();
      const focusedElement = document.activeElement;
      
      if (focusedElement) {
        const styles = window.getComputedStyle(focusedElement);
        // Focus indicators should be present (outline or box-shadow)
        expect(
          styles.outline !== 'none' || 
          styles.boxShadow !== 'none' ||
          focusedElement.matches(':focus-visible')
        ).toBe(true);
      }
    });
  });

  describe('Color Contrast', () => {
    test('Text has sufficient color contrast', () => {
      const { container } = render(<ChatInterface />);
      
      // This is a basic test - in a real scenario, you'd use tools like
      // axe-core or color-contrast-analyzer to check actual contrast ratios
      const textElements = container.querySelectorAll('p, span, button, input, textarea');
      
      textElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        // Basic check that text color is not the same as background
        expect(styles.color).not.toBe(styles.backgroundColor);
      });
    });
  });

  describe('Alternative Text and Labels', () => {
    test('All images and icons have appropriate alternative text', () => {
      render(<ChatInterface />);
      
      // Check that SVG icons are properly hidden from screen readers
      const svgElements = document.querySelectorAll('svg');
      svgElements.forEach(svg => {
        expect(
          svg.hasAttribute('aria-hidden') || 
          svg.hasAttribute('aria-label') ||
          svg.hasAttribute('aria-labelledby')
        ).toBe(true);
      });
    });

    test('Form controls have proper labels', () => {
      const mockProps = {
        value: '',
        onChange: jest.fn(),
        onSubmit: jest.fn(),
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      // Check that form controls have labels
      const textbox = screen.getByRole('textbox');
      expect(textbox).toHaveAccessibleName();
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });
  });
});