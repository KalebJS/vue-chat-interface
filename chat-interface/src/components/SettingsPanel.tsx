import React, { useState, useEffect } from 'react';
import type { 
  AppSettings, 
  VoiceSettings, 
  LangChainConfig, 
  ModelConfig,
  MemoryConfig,
  ChainConfig
} from '../types';
import { 
  ModelProvider, 
  MemoryType, 
  ChainType 
} from '../types';
import './SettingsPanel.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onClose: () => void;
  isOpen: boolean;
  availableVoices: SpeechSynthesisVoice[];
  className?: string;
}

/**
 * Settings panel component for configuring audio and AI model settings
 * Provides controls for voice settings, AI model parameters, and general preferences
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onClose,
  isOpen,
  availableVoices,
  className = ''
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
    setValidationErrors({});
  }, [settings]);

  // Validate settings
  const validateSettings = (settingsToValidate: AppSettings): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Voice settings validation
    if (settingsToValidate.voiceSettings.rate < 0.1 || settingsToValidate.voiceSettings.rate > 10) {
      errors.rate = 'Speech rate must be between 0.1 and 10';
    }

    if (settingsToValidate.voiceSettings.pitch < 0 || settingsToValidate.voiceSettings.pitch > 2) {
      errors.pitch = 'Speech pitch must be between 0 and 2';
    }

    // AI model validation
    if (settingsToValidate.aiModel.model.temperature < 0 || settingsToValidate.aiModel.model.temperature > 2) {
      errors.temperature = 'Temperature must be between 0 and 2';
    }

    if (settingsToValidate.aiModel.model.maxTokens < 1 || settingsToValidate.aiModel.model.maxTokens > 4000) {
      errors.maxTokens = 'Max tokens must be between 1 and 4000';
    }

    if (!settingsToValidate.aiModel.model.modelName.trim()) {
      errors.modelName = 'Model name is required';
    }

    // Memory validation
    if (settingsToValidate.aiModel.memory.maxTokenLimit && 
        (settingsToValidate.aiModel.memory.maxTokenLimit < 100 || settingsToValidate.aiModel.memory.maxTokenLimit > 10000)) {
      errors.maxTokenLimit = 'Memory token limit must be between 100 and 10000';
    }

    return errors;
  };

  const handleLocalChange = (updates: Partial<AppSettings>) => {
    const newSettings = { ...localSettings, ...updates };
    setLocalSettings(newSettings);
    setHasChanges(true);
    
    // Validate changes
    const errors = validateSettings(newSettings);
    setValidationErrors(errors);
  };

  const handleVoiceSettingsChange = (updates: Partial<VoiceSettings>) => {
    handleLocalChange({
      voiceSettings: { ...localSettings.voiceSettings, ...updates }
    });
  };

  const handleModelConfigChange = (updates: Partial<ModelConfig>) => {
    handleLocalChange({
      aiModel: {
        ...localSettings.aiModel,
        model: { ...localSettings.aiModel.model, ...updates }
      }
    });
  };

  const handleMemoryConfigChange = (updates: Partial<MemoryConfig>) => {
    handleLocalChange({
      aiModel: {
        ...localSettings.aiModel,
        memory: { ...localSettings.aiModel.memory, ...updates }
      }
    });
  };

  const handleChainConfigChange = (updates: Partial<ChainConfig>) => {
    handleLocalChange({
      aiModel: {
        ...localSettings.aiModel,
        chain: { ...localSettings.aiModel.chain, ...updates }
      }
    });
  };

  const handleSave = () => {
    const errors = validateSettings(localSettings);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    onSettingsChange(localSettings);
    setHasChanges(false);
    setValidationErrors({});
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
    setValidationErrors({});
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) {
        return;
      }
    }
    handleReset();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`settings-panel-overlay ${className}`}>
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button 
            className="close-button"
            onClick={handleClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className="settings-content">
          {/* General Settings */}
          <section className="settings-section">
            <h3>General</h3>
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={localSettings.autoScroll}
                  onChange={(e) => handleLocalChange({ autoScroll: e.target.checked })}
                />
                Auto-scroll to new messages
              </label>
            </div>
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={localSettings.audioEnabled}
                  onChange={(e) => handleLocalChange({ audioEnabled: e.target.checked })}
                />
                Enable audio features
              </label>
            </div>
          </section>

          {/* Voice Settings */}
          <section className="settings-section">
            <h3>Voice Settings</h3>
            
            <div className="setting-item">
              <label className="setting-label">
                Voice
                <select
                  value={localSettings.voiceSettings.voice || ''}
                  onChange={(e) => handleVoiceSettingsChange({ voice: e.target.value || undefined })}
                  className="setting-select"
                >
                  <option value="">Default</option>
                  {availableVoices.map((voice, index) => (
                    <option key={index} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                Speech Rate: {localSettings.voiceSettings.rate.toFixed(1)}
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={localSettings.voiceSettings.rate}
                  onChange={(e) => handleVoiceSettingsChange({ rate: parseFloat(e.target.value) })}
                  className="setting-range"
                />
              </label>
              {validationErrors.rate && (
                <span className="validation-error">{validationErrors.rate}</span>
              )}
            </div>

            <div className="setting-item">
              <label className="setting-label">
                Speech Pitch: {localSettings.voiceSettings.pitch.toFixed(1)}
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={localSettings.voiceSettings.pitch}
                  onChange={(e) => handleVoiceSettingsChange({ pitch: parseFloat(e.target.value) })}
                  className="setting-range"
                />
              </label>
              {validationErrors.pitch && (
                <span className="validation-error">{validationErrors.pitch}</span>
              )}
            </div>
          </section>

          {/* AI Model Settings */}
          <section className="settings-section">
            <h3>AI Model Configuration</h3>
            
            <div className="setting-item">
              <label className="setting-label">
                Provider
                <select
                  value={localSettings.aiModel.model.provider}
                  onChange={(e) => handleModelConfigChange({ provider: e.target.value as ModelProvider })}
                  className="setting-select"
                >
                  <option value={ModelProvider.OPENAI}>OpenAI</option>
                  <option value={ModelProvider.ANTHROPIC}>Anthropic</option>
                  <option value={ModelProvider.LOCAL}>Local Model</option>
                </select>
              </label>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                Model Name
                <input
                  type="text"
                  value={localSettings.aiModel.model.modelName}
                  onChange={(e) => handleModelConfigChange({ modelName: e.target.value })}
                  className="setting-input"
                  placeholder="e.g., gpt-3.5-turbo"
                />
              </label>
              {validationErrors.modelName && (
                <span className="validation-error">{validationErrors.modelName}</span>
              )}
            </div>

            <div className="setting-item">
              <label className="setting-label">
                Temperature: {localSettings.aiModel.model.temperature.toFixed(1)}
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={localSettings.aiModel.model.temperature}
                  onChange={(e) => handleModelConfigChange({ temperature: parseFloat(e.target.value) })}
                  className="setting-range"
                />
              </label>
              <small className="setting-description">
                Controls randomness: 0 = focused, 2 = creative
              </small>
              {validationErrors.temperature && (
                <span className="validation-error">{validationErrors.temperature}</span>
              )}
            </div>

            <div className="setting-item">
              <label className="setting-label">
                Max Tokens
                <input
                  type="number"
                  min="1"
                  max="4000"
                  value={localSettings.aiModel.model.maxTokens}
                  onChange={(e) => handleModelConfigChange({ maxTokens: parseInt(e.target.value) })}
                  className="setting-input"
                />
              </label>
              <small className="setting-description">
                Maximum length of AI responses
              </small>
              {validationErrors.maxTokens && (
                <span className="validation-error">{validationErrors.maxTokens}</span>
              )}
            </div>
          </section>

          {/* Memory Settings */}
          <section className="settings-section">
            <h3>Memory Configuration</h3>
            
            <div className="setting-item">
              <label className="setting-label">
                Memory Type
                <select
                  value={localSettings.aiModel.memory.type}
                  onChange={(e) => handleMemoryConfigChange({ type: e.target.value as MemoryType })}
                  className="setting-select"
                >
                  <option value={MemoryType.BUFFER}>Buffer Memory</option>
                  <option value={MemoryType.SUMMARY}>Summary Memory</option>
                  <option value={MemoryType.VECTOR}>Vector Memory</option>
                </select>
              </label>
              <small className="setting-description">
                How conversation history is stored and retrieved
              </small>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                Max Token Limit
                <input
                  type="number"
                  min="100"
                  max="10000"
                  value={localSettings.aiModel.memory.maxTokenLimit || 2000}
                  onChange={(e) => handleMemoryConfigChange({ maxTokenLimit: parseInt(e.target.value) })}
                  className="setting-input"
                />
              </label>
              <small className="setting-description">
                Maximum tokens to keep in memory
              </small>
              {validationErrors.maxTokenLimit && (
                <span className="validation-error">{validationErrors.maxTokenLimit}</span>
              )}
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={localSettings.aiModel.memory.returnMessages || false}
                  onChange={(e) => handleMemoryConfigChange({ returnMessages: e.target.checked })}
                />
                Return messages in memory format
              </label>
            </div>
          </section>

          {/* Chain Settings */}
          <section className="settings-section">
            <h3>Chain Configuration</h3>
            
            <div className="setting-item">
              <label className="setting-label">
                Chain Type
                <select
                  value={localSettings.aiModel.chain.type}
                  onChange={(e) => handleChainConfigChange({ type: e.target.value as ChainType })}
                  className="setting-select"
                >
                  <option value={ChainType.CONVERSATION}>Conversation</option>
                  <option value={ChainType.RETRIEVAL_QA}>Retrieval QA</option>
                </select>
              </label>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={localSettings.aiModel.chain.verbose || false}
                  onChange={(e) => handleChainConfigChange({ verbose: e.target.checked })}
                />
                Verbose logging
              </label>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={localSettings.aiModel.chain.streaming || false}
                  onChange={(e) => handleChainConfigChange({ streaming: e.target.checked })}
                />
                Enable streaming responses
              </label>
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <div className="settings-actions">
            <button 
              className="reset-button"
              onClick={handleReset}
              disabled={!hasChanges}
            >
              Reset
            </button>
            <button 
              className="save-button"
              onClick={handleSave}
              disabled={!hasChanges || Object.keys(validationErrors).length > 0}
            >
              Save Changes
            </button>
          </div>
          {hasChanges && (
            <div className="unsaved-changes-indicator">
              You have unsaved changes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};