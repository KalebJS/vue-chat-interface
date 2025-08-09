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
    <div className={`record-button-container ${className}`}>
      <button
        className={`record-button ${isRecording ? 'recording' : ''} ${isDisabled ? 'disabled' : ''}`}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        title={isRecording ? 'Stop recording' : 'Start voice recording'}
      >
        <div className="record-button-icon">
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
          <div className="recording-pulse-ring"></div>
        )}
      </button>
      
      {isRecording && (
        <div className="recording-timer" aria-live="polite">
          {formatTime(recordingTime)}
        </div>
      )}
    </div>
  );
};