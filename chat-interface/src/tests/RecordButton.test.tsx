import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordButton } from '../components/RecordButton';

describe('RecordButton', () => {
  const mockOnToggleRecording = vi.fn();

  const defaultProps = {
    isRecording: false,
    isLoading: false,
    audioEnabled: true,
    onToggleRecording: mockOnToggleRecording
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders record button with microphone icon when not recording', () => {
      render(<RecordButton {...defaultProps} />);
      
      const button = screen.getByRole('button', { name: /start voice recording/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('record-button');
      expect(button).not.toHaveClass('recording');
      
      // Check for microphone icon elements
      const micIcon = button.querySelector('.mic-icon');
      expect(micIcon).toBeInTheDocument();
    });

    it('renders record button with stop icon when recording', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const button = screen.getByRole('button', { name: /stop voice recording/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('record-button', 'recording');
      
      // Check for stop icon elements
      const stopIcon = button.querySelector('.stop-icon');
      expect(stopIcon).toBeInTheDocument();
    });

    it('applies custom className when provided', () => {
      render(<RecordButton {...defaultProps} className="custom-class" />);
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('shows recording timer when recording', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const timer = screen.getByText('0:00');
      expect(timer).toBeInTheDocument();
      expect(timer).toHaveClass('recording-timer');
    });

    it('does not show recording timer when not recording', () => {
      render(<RecordButton {...defaultProps} isRecording={false} />);
      
      const timer = screen.queryByText('0:00');
      expect(timer).not.toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('is enabled when audioEnabled is true and not loading', () => {
      render(<RecordButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      expect(button).not.toHaveClass('disabled');
    });

    it('is disabled when audioEnabled is false', () => {
      render(<RecordButton {...defaultProps} audioEnabled={false} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled');
    });

    it('is disabled when loading', () => {
      render(<RecordButton {...defaultProps} isLoading={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled');
    });

    it('is disabled when both audioEnabled is false and loading', () => {
      render(<RecordButton {...defaultProps} audioEnabled={false} isLoading={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled');
    });
  });

  describe('Recording Timer', () => {
    it('starts timer at 0:00 when recording begins', () => {
      const { rerender } = render(<RecordButton {...defaultProps} />);
      
      // Start recording
      rerender(<RecordButton {...defaultProps} isRecording={true} />);
      
      const timer = screen.getByText('0:00');
      expect(timer).toBeInTheDocument();
    });

    it('increments timer every second during recording', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      // Initial state
      expect(screen.getByText('0:00')).toBeInTheDocument();
      
      // After 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('0:01')).toBeInTheDocument();
      
      // After 5 seconds total
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByText('0:05')).toBeInTheDocument();
      
      // After 1 minute and 30 seconds total
      act(() => {
        vi.advanceTimersByTime(85000);
      });
      expect(screen.getByText('1:30')).toBeInTheDocument();
    });

    it('resets timer when recording stops', () => {
      const { rerender } = render(<RecordButton {...defaultProps} isRecording={true} />);
      
      // Let timer run for a few seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText('0:05')).toBeInTheDocument();
      
      // Stop recording
      rerender(<RecordButton {...defaultProps} isRecording={false} />);
      
      // Timer should be hidden
      expect(screen.queryByText('0:05')).not.toBeInTheDocument();
      expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    });

    it('resets timer when recording starts again', () => {
      const { rerender } = render(<RecordButton {...defaultProps} isRecording={true} />);
      
      // Let timer run
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(screen.getByText('0:10')).toBeInTheDocument();
      
      // Stop recording
      rerender(<RecordButton {...defaultProps} isRecording={false} />);
      
      // Start recording again
      rerender(<RecordButton {...defaultProps} isRecording={true} />);
      
      // Timer should start from 0:00
      expect(screen.getByText('0:00')).toBeInTheDocument();
    });

    it('formats timer correctly for different durations', () => {
      const { rerender } = render(<RecordButton {...defaultProps} isRecording={false} />);
      
      const testCases = [
        { seconds: 0, expected: '0:00' },
        { seconds: 5, expected: '0:05' },
        { seconds: 59, expected: '0:59' },
        { seconds: 60, expected: '1:00' },
        { seconds: 125, expected: '2:05' },
        { seconds: 3661, expected: '61:01' } // Over an hour
      ];
      
      for (const { seconds, expected } of testCases) {
        // Start recording to reset timer
        rerender(<RecordButton {...defaultProps} isRecording={true} />);
        
        // Advance time
        act(() => {
          vi.advanceTimersByTime(seconds * 1000);
        });
        expect(screen.getByText(expected)).toBeInTheDocument();
        
        // Stop recording for next iteration
        rerender(<RecordButton {...defaultProps} isRecording={false} />);
      }
    });
  });

  describe('User Interactions', () => {
    it('calls onToggleRecording when clicked and enabled', () => {
      render(<RecordButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockOnToggleRecording).toHaveBeenCalledTimes(1);
    });

    it('does not call onToggleRecording when disabled due to loading', () => {
      render(<RecordButton {...defaultProps} isLoading={true} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockOnToggleRecording).not.toHaveBeenCalled();
    });

    it('does not call onToggleRecording when disabled due to audioEnabled false', () => {
      render(<RecordButton {...defaultProps} audioEnabled={false} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockOnToggleRecording).not.toHaveBeenCalled();
    });

    it('calls onToggleRecording when recording and clicked', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockOnToggleRecording).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-label when not recording', () => {
      render(<RecordButton {...defaultProps} />);
      
      const button = screen.getByRole('button', { name: /start voice recording/i });
      expect(button).toHaveAttribute('aria-label', 'Start voice recording');
    });

    it('has correct aria-label when recording', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const button = screen.getByRole('button', { name: /stop voice recording/i });
      expect(button).toHaveAttribute('aria-label', 'Stop voice recording');
    });

    it('has correct title attribute when not recording', () => {
      render(<RecordButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Start voice recording');
    });

    it('has correct title attribute when recording', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Stop recording');
    });

    it('has aria-live region for timer updates', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const timer = screen.getByText('0:00');
      expect(timer).toHaveAttribute('aria-live', 'polite');
    });

    it('supports keyboard navigation', () => {
      render(<RecordButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      
      // Button should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);
      
      // Buttons respond to click events, not keyDown events by default
      // This is standard HTML behavior - browsers handle Enter/Space -> click conversion
      fireEvent.click(button);
      expect(mockOnToggleRecording).toHaveBeenCalledTimes(1);
    });
  });

  describe('Visual Feedback', () => {
    it('applies recording class when recording', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('recording');
    });

    it('does not apply recording class when not recording', () => {
      render(<RecordButton {...defaultProps} isRecording={false} />);
      
      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('recording');
    });

    it('shows pulse ring when recording', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const pulseRing = screen.getByRole('button').querySelector('.recording-pulse-ring');
      expect(pulseRing).toBeInTheDocument();
    });

    it('does not show pulse ring when not recording', () => {
      render(<RecordButton {...defaultProps} isRecording={false} />);
      
      const pulseRing = screen.getByRole('button').querySelector('.recording-pulse-ring');
      expect(pulseRing).not.toBeInTheDocument();
    });

    it('shows microphone icon when not recording', () => {
      render(<RecordButton {...defaultProps} isRecording={false} />);
      
      const micIcon = screen.getByRole('button').querySelector('.mic-icon');
      const stopIcon = screen.getByRole('button').querySelector('.stop-icon');
      
      expect(micIcon).toBeInTheDocument();
      expect(stopIcon).not.toBeInTheDocument();
    });

    it('shows stop icon when recording', () => {
      render(<RecordButton {...defaultProps} isRecording={true} />);
      
      const micIcon = screen.getByRole('button').querySelector('.mic-icon');
      const stopIcon = screen.getByRole('button').querySelector('.stop-icon');
      
      expect(micIcon).not.toBeInTheDocument();
      expect(stopIcon).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid state changes correctly', async () => {
      const { rerender } = render(<RecordButton {...defaultProps} />);
      
      // Rapidly toggle recording state
      rerender(<RecordButton {...defaultProps} isRecording={true} />);
      rerender(<RecordButton {...defaultProps} isRecording={false} />);
      rerender(<RecordButton {...defaultProps} isRecording={true} />);
      
      // Should show timer starting from 0:00
      expect(screen.getByText('0:00')).toBeInTheDocument();
    });

    it('cleans up timer when component unmounts during recording', () => {
      const { unmount } = render(<RecordButton {...defaultProps} isRecording={true} />);
      
      // Let timer run
      vi.advanceTimersByTime(5000);
      
      // Unmount component
      unmount();
      
      // Timer should not continue running (no errors should occur)
      vi.advanceTimersByTime(5000);
      // If cleanup worked properly, no errors should be thrown
    });

    it('handles missing onToggleRecording gracefully', () => {
      const propsWithoutCallback = {
        ...defaultProps,
        onToggleRecording: undefined as any
      };
      
      expect(() => {
        render(<RecordButton {...propsWithoutCallback} />);
      }).not.toThrow();
    });
  });
});