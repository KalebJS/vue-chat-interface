import React, { useState, useEffect } from 'react';
import type { AudioState, VoiceSettings } from '../types';
import './AudioControls.css';

interface AudioControlsProps {
  text: string;
  audioState: AudioState;
  voiceSettings?: VoiceSettings;
  onPlay: (text: string, settings?: VoiceSettings) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  className?: string;
  messageId: string;
}

/**
 * Audio controls component for playing, pausing, and stopping text-to-speech
 */
export const AudioControls: React.FC<AudioControlsProps> = ({
  text,
  audioState,
  voiceSettings,
  onPlay,
  onPause,
  onResume,
  onStop,
  className = '',
  messageId
}) => {
  // For this implementation, we'll assume that when audio is playing, it's for the current message
  // In a real implementation, you'd want to track which specific message is playing globally
  const isThisMessagePlaying = audioState.isPlaying;
  const isThisMessagePaused = audioState.isPaused;

  const handlePlay = () => {
    onPlay(text, voiceSettings);
  };

  const handlePause = () => {
    onPause();
  };

  const handleResume = () => {
    onResume();
  };

  const handleStop = () => {
    onStop();
  };

  const getPlayButtonContent = () => {
    if (!audioState.isSupported) {
      return '🔇 Not supported';
    }

    if (isThisMessagePlaying) {
      return '🔊 Playing...';
    }

    if (isThisMessagePaused) {
      return '⏸️ Paused';
    }

    return '🔊 Play Audio';
  };

  const getPlayButtonAction = () => {
    if (!audioState.isSupported) {
      return undefined;
    }

    if (isThisMessagePlaying) {
      return handlePause;
    }

    if (isThisMessagePaused) {
      return handleResume;
    }

    return handlePlay;
  };

  const controlsClasses = [
    'audio-controls',
    className,
    audioState.isSupported ? 'supported' : 'unsupported'
  ].filter(Boolean).join(' ');

  return (
    <div className={controlsClasses}>
      <button
        className="audio-control-button play-button"
        onClick={getPlayButtonAction()}
        disabled={!audioState.isSupported}
        aria-label={
          isThisMessagePlaying 
            ? 'Pause audio' 
            : isThisMessagePaused
              ? 'Resume audio'
              : 'Play audio'
        }
      >
        {getPlayButtonContent()}
      </button>

      {(isThisMessagePlaying || isThisMessagePaused) && (
        <button
          className="audio-control-button stop-button"
          onClick={handleStop}
          aria-label="Stop audio"
        >
          ⏹️ Stop
        </button>
      )}

      {audioState.error && (
        <div className="audio-error" role="alert">
          {audioState.error}
        </div>
      )}
    </div>
  );
};