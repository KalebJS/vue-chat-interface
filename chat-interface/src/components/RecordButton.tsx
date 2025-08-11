import React, { useEffect, useState } from 'react';
import './RecordButton.css';

interface RecordButtonProps {
  isRecording: boolean;
  isLoading: boolean;
  audioEnabled: boolean;
  onToggleRecording: () => void;
  className?: string;
}

/**
 * RecordButton component with recording state indicators and visual feedback
 * Provides pulsing animation and timer during recording
 */
export const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  isLoading,
  audioEnabled,
  onToggleRecording,
  className = ''
}) => {
  const [recordingTime, setRecordingTime] = useState(0);

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = () => {
    if (!isLoading && audioEnabled) {
      onToggleRecording();
    }
  };

  const isDisabled = isLoading || !audioEnabled;

  return (
    <div className={`record-button-container ${className}`} role="group" aria-label="Voice recording">
      <button
        className={`record-button ${isRecording ? 'recording' : ''} ${isDisabled ? 'disabled' : ''}`}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
        aria-describedby={isRecording ? "recording-timer" : undefined}
        aria-pressed={isRecording}
        title={isRecording ? 'Stop recording' : 'Start voice recording'}
        type="button"
      >
        <div className="record-button-icon" aria-hidden="true">
          {isRecording ? (
            <div className="stop-icon">
              <div className="stop-square"></div>
            </div>
          ) : (
            <div className="mic-icon">
              <div className="mic-body"></div>
              <div className="mic-stand"></div>
            </div>
          )}
        </div>
        
        {isRecording && (
          <div className="recording-pulse-ring" aria-hidden="true"></div>
        )}
      </button>
      
      {isRecording && (
        <div 
          id="recording-timer"
          className="recording-timer" 
          aria-live="polite"
          aria-label={`Recording time: ${formatTime(recordingTime)}`}
          role="timer"
        >
          {formatTime(recordingTime)}
        </div>
      )}
    </div>
  );
};