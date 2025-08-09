import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InputArea } from '../components/InputArea';

describe('InputArea', () => {
  const mockOnChange = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnToggleRecording = vi.fn();

  const defaultProps = {
    value: '',
    onChange: mockOnChange,
    onSubmit: mockOnSubmit,
    onToggleRecording: mockOnToggleRecording,
    isLoading: false,
    isRecording: false,
    audioEnabled: true,
    placeholder: 'Type your message...'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('renders input area with placeholder', () => {
    render(<InputArea {...defaultProps} />);

    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });

  it('displays current value in textarea', () => {
    render(<InputArea {...defaultProps} value="Test message" />);

    expect(screen.getByDisplayValue('Test message')).toBeInTheDocument();
  });

  it('calls onChange when text is typed', () => {
    render(<InputArea {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    expect(mockOnChange).toHaveBeenCalledWith('Hello');
  });

  it('calls onSubmit when send button is clicked', () => {
    render(<InputArea {...defaultProps} value="Test message" />);

    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('Test message');
  });

  it('calls onSubmit when Enter key is pressed', () => {
    render(<InputArea {...defaultProps} value="Test message" />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(mockOnSubmit).toHaveBeenCalledWith('Test message');
  });

  it('does not submit when Shift+Enter is pressed', () => {
    render(<InputArea {...defaultProps} value="Test message" />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('does not submit empty messages', () => {
    render(<InputArea {...defaultProps} value="   " />);

    const sendButton = screen.getByLabelText('Send message');
    fireEvent.click(sendButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('disables send button when loading', () => {
    render(<InputArea {...defaultProps} value="Test" isLoading={true} />);

    const sendButton = screen.getByLabelText('Send message');
    expect(sendButton).toBeDisabled();
  });

  it('disables textarea when loading', () => {
    render(<InputArea {...defaultProps} isLoading={true} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).toBeDisabled();
  });

  it('shows loading spinner when loading', () => {
    render(<InputArea {...defaultProps} isLoading={true} />);

    expect(screen.getByText('⏳')).toBeInTheDocument();
  });

  it('renders record button when audio is enabled', () => {
    render(<InputArea {...defaultProps} audioEnabled={true} />);

    expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
    expect(screen.getByText('🎤')).toBeInTheDocument();
  });

  it('does not render record button when audio is disabled', () => {
    render(<InputArea {...defaultProps} audioEnabled={false} />);

    expect(screen.queryByLabelText('Start recording')).not.toBeInTheDocument();
    expect(screen.queryByText('🎤')).not.toBeInTheDocument();
  });

  it('calls onToggleRecording when record button is clicked', () => {
    render(<InputArea {...defaultProps} audioEnabled={true} />);

    const recordButton = screen.getByLabelText('Start recording');
    fireEvent.click(recordButton);

    expect(mockOnToggleRecording).toHaveBeenCalled();
  });

  it('shows recording state when recording', () => {
    render(<InputArea {...defaultProps} isRecording={true} />);

    expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    expect(screen.getByText('⏹️')).toBeInTheDocument();
    expect(screen.getByText('Recording... Click stop when finished')).toBeInTheDocument();
  });

  it('applies recording class to record button when recording', () => {
    render(<InputArea {...defaultProps} isRecording={true} />);

    const recordButton = screen.getByLabelText('Stop recording');
    expect(recordButton).toHaveClass('recording');
  });

  it('disables record button when loading', () => {
    render(<InputArea {...defaultProps} isLoading={true} audioEnabled={true} />);

    const recordButton = screen.getByLabelText('Start recording');
    expect(recordButton).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <InputArea {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('input-area', 'custom-class');
  });

  it('enables send button only when there is text and not loading', () => {
    const { rerender } = render(<InputArea {...defaultProps} value="" />);
    
    let sendButton = screen.getByLabelText('Send message');
    expect(sendButton).toHaveClass('disabled');
    expect(sendButton).toBeDisabled();

    rerender(<InputArea {...defaultProps} value="Test" />);
    sendButton = screen.getByLabelText('Send message');
    expect(sendButton).toHaveClass('enabled');
    expect(sendButton).not.toBeDisabled();

    rerender(<InputArea {...defaultProps} value="Test" isLoading={true} />);
    sendButton = screen.getByLabelText('Send message');
    expect(sendButton).toBeDisabled();
  });

  it('handles textarea auto-resize', async () => {
    render(<InputArea {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type your message...');
    
    // Mock scrollHeight to simulate content height change
    Object.defineProperty(textarea, 'scrollHeight', {
      value: 100,
      writable: true
    });

    fireEvent.change(textarea, { target: { value: 'Long message\nwith\nmultiple\nlines' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('Long message\nwith\nmultiple\nlines');
    });
  });

  it('shows recording indicator only when recording', () => {
    const { rerender } = render(<InputArea {...defaultProps} isRecording={false} />);
    
    expect(screen.queryByText('Recording... Click stop when finished')).not.toBeInTheDocument();

    rerender(<InputArea {...defaultProps} isRecording={true} />);
    expect(screen.getByText('Recording... Click stop when finished')).toBeInTheDocument();
  });
});