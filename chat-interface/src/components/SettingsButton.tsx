import React from 'react';
import './SettingsButton.css';

interface SettingsButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Settings button component for opening the settings panel
 * Provides a gear icon button with hover effects and accessibility support
 */
export const SettingsButton: React.FC<SettingsButtonProps> = ({
  onClick,
  className = '',
  disabled = false
}) => {
  return (
    <button
      className={`settings-button ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label="Open settings panel"
      aria-expanded={false}
      aria-haspopup="dialog"
      title="Open settings"
      type="button"
    >
      <svg
        className="settings-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m15.5-3.5L19 4.5m-7 7L9.5 8.5m7 7L19 19.5m-7-7L9.5 15.5" />
      </svg>
      <span className="sr-only">Settings</span>
    </button>
  );
};