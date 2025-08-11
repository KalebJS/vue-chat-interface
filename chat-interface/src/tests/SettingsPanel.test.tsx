import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SettingsPanel } from '../components/SettingsPanel';
import type { AppSettings } from '../types';
import { ModelProvider, MemoryType, ChainType } from '../types';

// Mock settings data
const mockSettings: AppSettings = {
  autoScroll: true,
  audioEnabled: true,
  voiceSettings: {
    rate: 1.0,
    pitch: 1.0,
    voice: undefined
  },
  aiModel: {
    model: {
      provider: ModelProvider.OPENAI,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000
    },
    memory: {
      type: MemoryType.BUFFER,
      maxTokenLimit: 2000,
      returnMessages: true
    },
    chain: {
      type: ChainType.CONVERSATION,
      verbose: false,
      streaming: true
    }
  }
};

const mockVoices: SpeechSynthesisVoice[] = [
  {
    name: 'Test Voice 1',
    lang: 'en-US',
    voiceURI: 'test-voice-1',
    localService: true,
    default: true
  } as SpeechSynthesisVoice,
  {
    name: 'Test Voice 2',
    lang: 'en-GB',
    voiceURI: 'test-voice-2',
    localService: true,
    default: false
  } as SpeechSynthesisVoice
];

const defaultProps = {
  settings: mockSettings,
  onSettingsChange: vi.fn(),
  onClose: vi.fn(),
  isOpen: true,
  availableVoices: mockVoices,
  className: ''
};

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders when open', () => {
      render(<SettingsPanel {...defaultProps} />);
      
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Voice Settings')).toBeInTheDocument();
      expect(screen.getByText('AI Model Configuration')).toBeInTheDocument();
      expect(screen.getByText('Memory Configuration')).toBeInTheDocument();
      expect(screen.getByText('Chain Configuration')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<SettingsPanel {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('renders with correct initial values', () => {
      render(<SettingsPanel {...defaultProps} />);
      
      // General settings
      expect(screen.getByLabelText(/auto-scroll/i)).toBeChecked();
      expect(screen.getByLabelText(/enable audio/i)).toBeChecked();
      
      // AI model settings
      expect(screen.getByDisplayValue('gpt-3.5-turbo')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });
  });

  describe('General Settings', () => {
    it('toggles auto-scroll setting', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      
      render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);
      
      const autoScrollCheckbox = screen.getByLabelText(/auto-scroll/i);
      await user.click(autoScrollCheckbox);
      
      // Click save button
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);
      
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          autoScroll: false
        })
      );
    });

    it('toggles audio enabled setting', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      
      render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);
      
      const audioEnabledCheckbox = screen.getByLabelText(/enable audio/i);
      await user.click(audioEnabledCheckbox);
      
      // Click save button
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);
      
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          audioEnabled: false
        })
      );
    });
  });

  describe('Voice Settings', () => {
    it('changes speech rate', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      
      render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);
      
      const rateSlider = screen.getByLabelText(/speech rate/i);
      fireEvent.change(rateSlider, { target: { value: '1.5' } });
      
      // Click save button
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);
      
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceSettings: expect.objectContaining({
            rate: 1.5
          })
        })
      );
    });

    it('changes speech pitch', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      
      render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);
      
      const pitchSlider = screen.getByLabelText(/speech pitch/i);
      fireEvent.change(pitchSlider, { target: { value: '1.2' } });
      
      // Click save button
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);
      
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceSettings: expect.objectContaining({
            pitch: 1.2
          })
        })
      );
    });
  });

  describe('AI Model Settings', () => {
    it('changes model provider', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      
      render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);
      
      const providerSelect = screen.getByLabelText(/provider/i);
      await user.selectOptions(providerSelect, ModelProvider.ANTHROPIC);
      
      // Click save button
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);
      
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          aiModel: expect.objectContaining({
            model: expect.objectContaining({
              provider: ModelProvider.ANTHROPIC
            })
          })
        })
      );
    });

    it('changes model name', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      
      render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);
      
      const modelNameInput = screen.getByLabelText(/model name/i);
      await user.clear(modelNameInput);
      await user.type(modelNameInput, 'gpt-4');
      
      // Click save button
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);
      
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          aiModel: expect.objectContaining({
            model: expect.objectContaining({
              modelName: 'gpt-4'
            })
          })
        })
      );
    });

    it('changes temperature', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      
      render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);
      
      const temperatureSlider = screen.getByLabelText(/temperature/i);
      fireEvent.change(temperatureSlider, { target: { value: '1.2' } });
      
      // Click save button
      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);
      
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          aiModel: expect.objectContaining({
            model: expect.objectContaining({
              temperature: 1.2
            })
          })
        })
      );
    });
  });

  describe('Validation', () => {
    it('handles range input changes', async () => {
      render(<SettingsPanel {...defaultProps} />);
      
      const rateSlider = screen.getByLabelText(/speech rate/i);
      fireEvent.change(rateSlider, { target: { value: '2.0' } });
      
      // Component should handle the change
      expect(rateSlider).toHaveValue('2');
    });

    it('handles temperature changes', async () => {
      render(<SettingsPanel {...defaultProps} />);
      
      const temperatureSlider = screen.getByLabelText(/temperature/i);
      fireEvent.change(temperatureSlider, { target: { value: '1.5' } });
      
      // Component should handle the change
      expect(temperatureSlider).toHaveValue('1.5');
    });

    it('handles model name input', async () => {
      const user = userEvent.setup();
      
      render(<SettingsPanel {...defaultProps} />);
      
      const modelNameInput = screen.getByLabelText(/model name/i);
      await user.clear(modelNameInput);
      await user.type(modelNameInput, 'new-model');
      
      // Component should handle the change
      expect(modelNameInput).toHaveValue('new-model');
    });
  });

  describe('Actions', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<SettingsPanel {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByLabelText(/close settings/i);
      await user.click(closeButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    it('resets changes when reset button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<SettingsPanel {...defaultProps} />);
      
      // Make a change
      const autoScrollCheckbox = screen.getByLabelText(/auto-scroll/i);
      await user.click(autoScrollCheckbox);
      
      // Reset should be enabled
      const resetButton = screen.getByText('Reset');
      expect(resetButton).not.toBeDisabled();
      
      await user.click(resetButton);
      
      // Changes should be reverted
      expect(autoScrollCheckbox).toBeChecked();
      expect(resetButton).toBeDisabled();
    });

    it('shows unsaved changes indicator when changes are made', async () => {
      const user = userEvent.setup();
      
      render(<SettingsPanel {...defaultProps} />);
      
      // Make a change
      const autoScrollCheckbox = screen.getByLabelText(/auto-scroll/i);
      await user.click(autoScrollCheckbox);
      
      // Should show unsaved changes indicator
      expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument();
      
      // Save and reset buttons should be enabled
      expect(screen.getByText('Save Changes')).not.toBeDisabled();
      expect(screen.getByText('Reset')).not.toBeDisabled();
    });

    it('confirms before closing with unsaved changes', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(<SettingsPanel {...defaultProps} onClose={onClose} />);
      
      // Make a change
      const autoScrollCheckbox = screen.getByLabelText(/auto-scroll/i);
      await user.click(autoScrollCheckbox);
      
      // Try to close
      const closeButton = screen.getByLabelText(/close settings/i);
      await user.click(closeButton);
      
      expect(confirmSpy).toHaveBeenCalledWith(
        'You have unsaved changes. Are you sure you want to close?'
      );
      expect(onClose).not.toHaveBeenCalled();
      
      confirmSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<SettingsPanel {...defaultProps} />);
      
      expect(screen.getByLabelText(/close settings/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/auto-scroll/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/enable audio/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/speech rate/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/speech pitch/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<SettingsPanel {...defaultProps} />);
      
      // Tab through elements
      await user.tab();
      expect(screen.getByLabelText(/close settings/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText(/auto-scroll/i)).toHaveFocus();
      
      // Should be able to toggle with space
      await user.keyboard(' ');
      expect(screen.getByLabelText(/auto-scroll/i)).not.toBeChecked();
    });
  });
});