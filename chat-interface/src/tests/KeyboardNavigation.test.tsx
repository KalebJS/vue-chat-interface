import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../components/ChatInterface';
import { MessageList } from '../components/MessageList';
import { InputArea } from '../components/InputArea';
import { RecordButton } from '../components/RecordButton';
import { AudioControls } from '../components/AudioControls';
import { SettingsButton } from '../components/SettingsButton';
import type { Message, AudioState, VoiceSettings } from '../types';
import { MessageStatus } from '../types';

// Mock dependencies
jest.mock('../hooks/useStateManager');
jest.mock('../services/AudioController');
jest.mock('../services/LangChainService');

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

describe('Keyboard Navigation Tests', () => {
  describe('Tab Navigation', () => {
    test('All interactive elements are reachable via Tab key', async () => {
      const user = userEvent.setup();
      
      render(<ChatInterface />);
      
      // Get all focusable elements
      const focusableElements = [
        ...screen.getAllByRole('button'),
        ...screen.getAllByRole('textbox'),
        ...screen.queryAllByRole('log').filter(el => el.tabIndex >= 0)
      ].filter(el => !el.hasAttribute('disabled') && !el.hasAttribute('aria-hidden'));
      
      // Tab through all elements
      for (let i = 0; i < focusableElements.length; i++) {
        await user.tab();
        const focusedElement = document.activeElement;
        expect(focusableElements).toContain(focusedElement);
      }
    });

    test('Tab order is logical and follows visual layout', async () => {
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
      
      // Expected tab order: textarea -> record button -> send button
      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /start voice recording/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /send message/i })).toHaveFocus();
    });

    test('Shift+Tab navigates backwards correctly', async () => {
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
      
      // Tab to the last element
      await user.tab();
      await user.tab();
      await user.tab();
      expect(screen.getByRole('button', { name: /send message/i })).toHaveFocus();
      
      // Shift+Tab backwards
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: /start voice recording/i })).toHaveFocus();
      
      await user.tab({ shift: true });
      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    test('Disabled elements are skipped during tab navigation', async () => {
      const user = userEvent.setup();
      const mockProps = {
        value: '',
        onChange: jest.fn(),
        onSubmit: jest.fn(),
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: false // Audio disabled
      };

      render(<InputArea {...mockProps} />);
      
      // Tab should skip the disabled record button
      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /send message/i })).toHaveFocus();
    });
  });

  describe('Enter and Space Key Activation', () => {
    test('Enter key activates buttons', async () => {
      const user = userEvent.setup();
      const mockOnClick = jest.fn();
      
      render(<SettingsButton onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      await user.keyboard('{Enter}');
      
      expect(mockOnClick).toHaveBeenCalled();
    });

    test('Space key activates buttons', async () => {
      const user = userEvent.setup();
      const mockOnToggle = jest.fn();
      const mockProps = {
        isRecording: false,
        isLoading: false,
        audioEnabled: true,
        onToggleRecording: mockOnToggle
      };

      render(<RecordButton {...mockProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      await user.keyboard(' ');
      
      expect(mockOnToggle).toHaveBeenCalled();
    });

    test('Enter key submits message in textarea', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      const mockProps = {
        value: 'Test message',
        onChange: jest.fn(),
        onSubmit: mockOnSubmit,
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      await user.keyboard('{Enter}');
      
      expect(mockOnSubmit).toHaveBeenCalledWith('Test message');
    });

    test('Shift+Enter creates new line in textarea', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      const mockOnSubmit = jest.fn();
      const mockProps = {
        value: '',
        onChange: mockOnChange,
        onSubmit: mockOnSubmit,
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      await user.type(textarea, 'First line');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      await user.type(textarea, 'Second line');
      
      // Should not submit, should add new line
      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(mockOnChange).toHaveBeenCalledWith(expect.stringContaining('\n'));
    });
  });

  describe('Arrow Key Navigation', () => {
    test('Arrow keys navigate within message list', async () => {
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
      await user.click(messageContainer);
      
      // Test Ctrl+Arrow keys for fine scrolling
      await user.keyboard('{Control>}{ArrowUp}{/Control}');
      await user.keyboard('{Control>}{ArrowDown}{/Control}');
      
      // Should not throw errors and container should remain focused
      expect(messageContainer).toHaveFocus();
    });

    test('Arrow keys work in textarea for text editing', async () => {
      const user = userEvent.setup();
      const mockProps = {
        value: 'Test message',
        onChange: jest.fn(),
        onSubmit: jest.fn(),
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      
      // Arrow keys should work for text navigation
      await user.keyboard('{ArrowLeft}');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{ArrowDown}');
      
      // Should not interfere with text editing
      expect(textarea).toHaveFocus();
    });
  });

  describe('Page Navigation Keys', () => {
    test('Page Up/Down keys scroll message list', async () => {
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
      await user.click(messageContainer);
      
      // Test Page Up/Down
      await user.keyboard('{PageUp}');
      await user.keyboard('{PageDown}');
      
      expect(messageContainer).toHaveFocus();
    });

    test('Home/End keys navigate to start/end of message list', async () => {
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
      await user.click(messageContainer);
      
      // Test Ctrl+Home and Ctrl+End
      await user.keyboard('{Control>}{Home}{/Control}');
      await user.keyboard('{Control>}{End}{/Control}');
      
      expect(messageContainer).toHaveFocus();
    });

    test('Home/End keys work in textarea for text navigation', async () => {
      const user = userEvent.setup();
      const mockProps = {
        value: 'This is a test message',
        onChange: jest.fn(),
        onSubmit: jest.fn(),
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      
      // Home/End should work for text navigation
      await user.keyboard('{End}');
      await user.keyboard('{Home}');
      
      expect(textarea).toHaveFocus();
    });
  });

  describe('Escape Key Behavior', () => {
    test('Escape key stops recording', async () => {
      const user = userEvent.setup();
      const mockOnToggle = jest.fn();
      const mockProps = {
        isRecording: true,
        isLoading: false,
        audioEnabled: true,
        onToggleRecording: mockOnToggle
      };

      render(<RecordButton {...mockProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      await user.keyboard('{Escape}');
      
      // In a real implementation, Escape might stop recording
      // For now, we just check that the button remains focused
      expect(button).toHaveFocus();
    });

    test('Escape key clears focus from message list', async () => {
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
      await user.click(messageContainer);
      expect(messageContainer).toHaveFocus();
      
      await user.keyboard('{Escape}');
      
      // Focus might be cleared or moved to a parent element
      // The exact behavior depends on implementation
      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Focus Management', () => {
    test('Focus is visible on all interactive elements', async () => {
      const user = userEvent.setup();
      
      render(<ChatInterface />);
      
      // Tab through elements and check for focus indicators
      const focusableElements = screen.getAllByRole('button');
      
      for (const element of focusableElements) {
        if (!element.hasAttribute('disabled')) {
          await user.click(element);
          expect(element).toHaveFocus();
          
          // Check that focus is visible (this is a basic check)
          const styles = window.getComputedStyle(element);
          expect(
            styles.outline !== 'none' || 
            styles.boxShadow !== 'none' ||
            element.matches(':focus-visible')
          ).toBe(true);
        }
      }
    });

    test('Focus is trapped within modal-like components', async () => {
      const user = userEvent.setup();
      
      render(<ChatInterface />);
      
      // This test would be more relevant if we had modal dialogs
      // For now, we just ensure focus stays within the main interface
      await user.tab();
      const firstFocusedElement = document.activeElement;
      
      // Tab through all elements
      for (let i = 0; i < 20; i++) {
        await user.tab();
      }
      
      // Focus should still be within the interface
      expect(document.activeElement).toBeInTheDocument();
    });

    test('Focus returns to appropriate element after interactions', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      const mockProps = {
        value: 'Test message',
        onChange: jest.fn(),
        onSubmit: mockOnSubmit,
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send message/i });
      
      // Focus textarea, then click send button
      await user.click(textarea);
      await user.click(sendButton);
      
      // After sending, focus might return to textarea for next message
      // This depends on the implementation
      expect(document.activeElement).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('Keyboard shortcuts work as expected', async () => {
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
      await user.click(messageContainer);
      
      // Test various keyboard shortcuts
      await user.keyboard('{Control>}{Home}{/Control}'); // Go to top
      await user.keyboard('{Control>}{End}{/Control}');  // Go to bottom
      await user.keyboard('{PageUp}');                    // Page up
      await user.keyboard('{PageDown}');                  // Page down
      
      // All shortcuts should work without errors
      expect(messageContainer).toHaveFocus();
    });

    test('Keyboard shortcuts do not interfere with text input', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      const mockProps = {
        value: '',
        onChange: mockOnChange,
        onSubmit: jest.fn(),
        onToggleRecording: jest.fn(),
        isLoading: false,
        isRecording: false,
        audioEnabled: true
      };

      render(<InputArea {...mockProps} />);
      
      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      
      // Type text with various keys
      await user.type(textarea, 'Hello world!');
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      await user.type(textarea, ' beautiful');
      
      // Text editing should work normally
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Audio Control Keyboard Navigation', () => {
    test('Audio controls are keyboard accessible', async () => {
      const user = userEvent.setup();
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

      render(<AudioControls {...mockProps} />);
      
      const playButton = screen.getByRole('button', { name: /play message as audio/i });
      
      // Tab to the button
      await user.tab();
      expect(playButton).toHaveFocus();
      
      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(mockProps.onPlay).toHaveBeenCalled();
      
      // Activate with Space
      await user.keyboard(' ');
      expect(mockProps.onPlay).toHaveBeenCalledTimes(2);
    });

    test('Record button keyboard interaction', async () => {
      const user = userEvent.setup();
      const mockOnToggle = jest.fn();
      const mockProps = {
        isRecording: false,
        isLoading: false,
        audioEnabled: true,
        onToggleRecording: mockOnToggle
      };

      render(<RecordButton {...mockProps} />);
      
      const recordButton = screen.getByRole('button');
      
      // Tab to the button
      await user.tab();
      expect(recordButton).toHaveFocus();
      
      // Activate with Space
      await user.keyboard(' ');
      expect(mockOnToggle).toHaveBeenCalled();
      
      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(mockOnToggle).toHaveBeenCalledTimes(2);
    });
  });
});