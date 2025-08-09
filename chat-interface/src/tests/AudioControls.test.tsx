import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioControls } from '../components/AudioControls';
import type { AudioState, VoiceSettings } from '../types';

describe('AudioControls', () => {
  const mockAudioState: AudioState = {
    isRecording: false,
    isPlaying: false,
    isPaused: false,
    isSupported: true,
    hasPermission: true,
    error: undefined
  };

  const mockVoiceSettings: VoiceSettings = {
    rate: 1,
    pitch: 1,
    voice: 'Test Voice'
  };

  const mockProps = {
    text: 'Hello world',
    audioState: mockAudioState,
    voiceSettings: mockVoiceSettings,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    messageId: 'test-message-1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render play button when not playing', () => {
      render(<AudioControls {...mockProps} />);
      
      const playButton = screen.getByRole('button', { name: /play audio/i });
      expect(playButton).toBeInTheDocument();
      expect(playButton).toHaveTextContent('🔊 Play Audio');
    });

    it('should render playing state when audio is playing', () => {
      const playingState = { ...mockAudioState, isPlaying: true };
      render(<AudioControls {...mockProps} audioState={playingState} />);
      
      const playButton = screen.getByRole('button', { name: /pause audio/i });
      expect(playButton).toBeInTheDocument();
      expect(playButton).toHaveTextContent('🔊 Playing...');
    });

    it('should render paused state when audio is paused', () => {
      const pausedState = { ...mockAudioState, isPaused: true };
      render(<AudioControls {...mockProps} audioState={pausedState} />);
      
      const resumeButton = screen.getByRole('button', { name: /resume audio/i });
      expect(resumeButton).toBeInTheDocument();
      expect(resumeButton).toHaveTextContent('⏸️ Paused');
    });

    it('should render stop button when playing', () => {
      const playingState = { ...mockAudioState, isPlaying: true };
      render(<AudioControls {...mockProps} audioState={playingState} />);
      
      const stopButton = screen.getByRole('button', { name: /stop audio/i });
      expect(stopButton).toBeInTheDocument();
      expect(stopButton).toHaveTextContent('⏹️ Stop');
    });

    it('should render stop button when paused', () => {
      const pausedState = { ...mockAudioState, isPaused: true };
      render(<AudioControls {...mockProps} audioState={pausedState} />);
      
      const stopButton = screen.getByRole('button', { name: /stop audio/i });
      expect(stopButton).toBeInTheDocument();
    });

    it('should not render stop button when not playing or paused', () => {
      render(<AudioControls {...mockProps} />);
      
      const stopButton = screen.queryByRole('button', { name: /stop audio/i });
      expect(stopButton).not.toBeInTheDocument();
    });

    it('should render error message when error exists', () => {
      const errorState = { ...mockAudioState, error: 'Test error message' };
      render(<AudioControls {...mockProps} audioState={errorState} />);
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveTextContent('Test error message');
    });

    it('should render unsupported state when audio not supported', () => {
      const unsupportedState = { ...mockAudioState, isSupported: false };
      render(<AudioControls {...mockProps} audioState={unsupportedState} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('🔇 Not supported');
    });
  });

  describe('User Interactions', () => {
    it('should call onPlay when play button is clicked', () => {
      render(<AudioControls {...mockProps} />);
      
      const playButton = screen.getByRole('button', { name: /play audio/i });
      fireEvent.click(playButton);
      
      expect(mockProps.onPlay).toHaveBeenCalledWith('Hello world', mockVoiceSettings);
    });

    it('should call onPause when playing and button is clicked', () => {
      const playingState = { ...mockAudioState, isPlaying: true };
      render(<AudioControls {...mockProps} audioState={playingState} />);
      
      const pauseButton = screen.getByRole('button', { name: /pause audio/i });
      fireEvent.click(pauseButton);
      
      expect(mockProps.onPause).toHaveBeenCalled();
    });

    it('should call onResume when paused and button is clicked', () => {
      const pausedState = { ...mockAudioState, isPaused: true };
      render(<AudioControls {...mockProps} audioState={pausedState} />);
      
      const resumeButton = screen.getByRole('button', { name: /resume audio/i });
      fireEvent.click(resumeButton);
      
      expect(mockProps.onResume).toHaveBeenCalled();
    });

    it('should call onStop when stop button is clicked', () => {
      const playingState = { ...mockAudioState, isPlaying: true };
      render(<AudioControls {...mockProps} audioState={playingState} />);
      
      const stopButton = screen.getByRole('button', { name: /stop audio/i });
      fireEvent.click(stopButton);
      
      expect(mockProps.onStop).toHaveBeenCalled();
    });

    it('should not call handlers when audio is not supported', () => {
      const unsupportedState = { ...mockAudioState, isSupported: false };
      render(<AudioControls {...mockProps} audioState={unsupportedState} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockProps.onPlay).not.toHaveBeenCalled();
      expect(mockProps.onPause).not.toHaveBeenCalled();
      expect(mockProps.onResume).not.toHaveBeenCalled();
    });
  });

  describe('Message-specific behavior', () => {
    it('should track playing state for specific message', () => {
      const { rerender } = render(<AudioControls {...mockProps} />);
      
      // Start playing
      const playingState = { ...mockAudioState, isPlaying: true };
      rerender(<AudioControls {...mockProps} audioState={playingState} />);
      
      const pauseButton = screen.getByRole('button', { name: /pause audio/i });
      expect(pauseButton).toHaveTextContent('🔊 Playing...');
    });

    it('should show playing state for all messages when audio is playing', () => {
      const playingState = { ...mockAudioState, isPlaying: true };
      render(<AudioControls {...mockProps} audioState={playingState} messageId="different-message" />);
      
      // In this simplified implementation, all messages show playing state when audio is playing
      const pauseButton = screen.getByRole('button', { name: /pause audio/i });
      expect(pauseButton).toHaveTextContent('🔊 Playing...');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for play button', () => {
      render(<AudioControls {...mockProps} />);
      
      const playButton = screen.getByRole('button', { name: /play audio/i });
      expect(playButton).toHaveAttribute('aria-label', 'Play audio');
    });

    it('should have proper ARIA labels for pause button', () => {
      const playingState = { ...mockAudioState, isPlaying: true };
      render(<AudioControls {...mockProps} audioState={playingState} />);
      
      const pauseButton = screen.getByRole('button', { name: /pause audio/i });
      expect(pauseButton).toHaveAttribute('aria-label', 'Pause audio');
    });

    it('should have proper ARIA labels for resume button', () => {
      const pausedState = { ...mockAudioState, isPaused: true };
      render(<AudioControls {...mockProps} audioState={pausedState} />);
      
      const resumeButton = screen.getByRole('button', { name: /resume audio/i });
      expect(resumeButton).toHaveAttribute('aria-label', 'Resume audio');
    });

    it('should have proper ARIA labels for stop button', () => {
      const playingState = { ...mockAudioState, isPlaying: true };
      render(<AudioControls {...mockProps} audioState={playingState} />);
      
      const stopButton = screen.getByRole('button', { name: /stop audio/i });
      expect(stopButton).toHaveAttribute('aria-label', 'Stop audio');
    });

    it('should have role="alert" for error messages', () => {
      const errorState = { ...mockAudioState, error: 'Test error' };
      render(<AudioControls {...mockProps} audioState={errorState} />);
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('CSS Classes', () => {
    it('should apply supported class when audio is supported', () => {
      const { container } = render(<AudioControls {...mockProps} />);
      
      const audioControls = container.querySelector('.audio-controls');
      expect(audioControls).toHaveClass('supported');
    });

    it('should apply unsupported class when audio is not supported', () => {
      const unsupportedState = { ...mockAudioState, isSupported: false };
      const { container } = render(<AudioControls {...mockProps} audioState={unsupportedState} />);
      
      const audioControls = container.querySelector('.audio-controls');
      expect(audioControls).toHaveClass('unsupported');
    });

    it('should apply custom className', () => {
      const { container } = render(<AudioControls {...mockProps} className="custom-class" />);
      
      const audioControls = container.querySelector('.audio-controls');
      expect(audioControls).toHaveClass('custom-class');
    });
  });
});