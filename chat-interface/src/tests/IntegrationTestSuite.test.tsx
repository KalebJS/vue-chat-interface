import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInterface } from "../components/ChatInterface";

// Mock the useStateManager hook
const mockUseStateManager = vi.fn();
vi.mock("../hooks/useStateManager", () => ({
    useStateManager: () => mockUseStateManager(),
}));

describe("Comprehensive Integration Test Suite", () => {
    let user: ReturnType<typeof userEvent.setup>;
    let mockState: any;
    let mockActions: any;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();

        // Default mock state
        mockState = {
            messages: [],
            currentInput: "",
            isLoading: false,
            audioState: {
                isRecording: false,
                isPlaying: false,
                isSupported: true,
                hasPermission: true,
                error: undefined,
            },
            langChainState: {
                isInitialized: true,
                currentModel: "gpt-3.5-turbo",
                conversationId: "test-conv",
                tokenCount: 0,
                memorySize: 0,
                isStreaming: false,
            },
            error: undefined,
            settings: {
                autoScroll: true,
                audioEnabled: true,
                voiceSettings: { rate: 1, pitch: 1, voice: "default" },
                aiModel: {
                    model: { provider: "openai", modelName: "gpt-3.5-turbo", temperature: 0.7, maxTokens: 1000 },
                    memory: { type: "buffer" },
                    chain: { type: "conversation" },
                },
            },
        };

        // Default mock actions
        mockActions = {
            updateState: vi.fn(),
            updateMessages: vi.fn(),
            updateCurrentInput: vi.fn(),
            updateLoadingState: vi.fn(),
            updateAudioState: vi.fn(),
            updateLangChainState: vi.fn(),
            updateSettings: vi.fn(),
            updateError: vi.fn(),
            addMessage: vi.fn(),
            updateMessage: vi.fn(),
            clearMessages: vi.fn(),
            loadConversationHistory: vi.fn().mockResolvedValue(undefined),
            loadMoreHistory: vi.fn().mockResolvedValue([]),
            resetState: vi.fn(),
            clearPersistedState: vi.fn(),
            initializeLangChain: vi.fn().mockResolvedValue(undefined),
            sendMessage: vi.fn().mockResolvedValue(undefined),
            sendMessageLegacy: vi.fn().mockResolvedValue(undefined),
            clearLangChainMemory: vi.fn().mockResolvedValue(undefined),
            resetSettings: vi.fn(),
            getAvailableVoices: vi.fn().mockReturnValue([]),
            updateModelConfig: vi.fn().mockResolvedValue(undefined),
            stateManager: null,
            langChainService: null,
            getDebugInfo: vi.fn().mockReturnValue({}),
        };

        // Setup mock implementation
        mockUseStateManager.mockReturnValue({
            state: mockState,
            ...mockActions,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("End-to-End Conversation Flows", () => {
        it("should handle complete text conversation workflow", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText("Type your message...");
            const sendButton = screen.getByLabelText("Send message");

            // Type and send message
            await user.type(input, "Hello, AI!");
            expect(input).toHaveValue("Hello, AI!");

            await user.click(sendButton);

            // Verify message was sent
            expect(mockActions.sendMessage).toHaveBeenCalledWith("Hello, AI!", true);

            // Simulate message appearing in state
            act(() => {
                mockState.messages = [
                    {
                        id: "1",
                        text: "Hello, AI!",
                        sender: "user",
                        timestamp: new Date(),
                        status: "sent",
                    },
                    {
                        id: "2",
                        text: "Hello! How can I help you today?",
                        sender: "ai",
                        timestamp: new Date(),
                        status: "sent",
                    },
                ];
                mockUseStateManager.mockReturnValue({
                    state: mockState,
                    ...mockActions,
                });
            });

            // Re-render to show updated messages
            render(<ChatInterface />);

            // Verify conversation appears
            await waitFor(() => {
                expect(screen.getByText("Hello, AI!")).toBeInTheDocument();
                expect(screen.getByText("Hello! How can I help you today?")).toBeInTheDocument();
            });
        });

        it("should handle keyboard navigation and accessibility", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Test Tab navigation
            await user.tab();
            expect(screen.getByPlaceholderText("Type your message...")).toHaveFocus();

            await user.tab();
            expect(screen.getByLabelText("Send message")).toHaveFocus();

            await user.tab();
            expect(screen.getByLabelText("Start recording")).toHaveFocus();

            // Test Enter key to send message
            const input = screen.getByPlaceholderText("Type your message...");
            input.focus();

            await user.type(input, "Test keyboard shortcut");
            await user.keyboard("{Enter}");

            expect(mockActions.sendMessage).toHaveBeenCalledWith("Test keyboard shortcut", true);
        });

        it("should prevent sending empty messages", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const sendButton = screen.getByLabelText("Send message");

            // Try to send empty message
            await user.click(sendButton);
            expect(mockActions.sendMessage).not.toHaveBeenCalled();

            // Try with whitespace only
            const input = screen.getByPlaceholderText("Type your message...");
            await user.type(input, "   ");
            await user.click(sendButton);
            expect(mockActions.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe("Audio Interaction Workflows", () => {
        it("should handle audio recording workflow", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Should show record button when audio is supported
            expect(screen.getByLabelText("Start recording")).toBeInTheDocument();

            // Click record button
            const recordButton = screen.getByLabelText("Start recording");
            await user.click(recordButton);

            // Should update audio state to recording
            expect(mockActions.updateAudioState).toHaveBeenCalledWith({ isRecording: true });
        });

        it("should handle audio unavailable state", async () => {
            // Mock audio not supported
            mockState.audioState = {
                isRecording: false,
                isPlaying: false,
                isSupported: false,
                hasPermission: false,
                error: "Audio not supported",
            };

            mockUseStateManager.mockReturnValue({
                state: mockState,
                ...mockActions,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("Audio Unavailable")).toBeInTheDocument();
                expect(screen.getByText("Audio not supported")).toBeInTheDocument();
            });

            // Text input should still work
            const input = screen.getByPlaceholderText("Type your message...");
            expect(input).toBeInTheDocument();
            expect(input).not.toBeDisabled();
        });

        it("should handle audio permission recovery", async () => {
            // Mock permission denied initially
            mockState.audioState = {
                isRecording: false,
                isPlaying: false,
                isSupported: true,
                hasPermission: false,
                error: "Microphone permission denied",
            };

            mockUseStateManager.mockReturnValue({
                state: mockState,
                ...mockActions,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("Microphone permission denied")).toBeInTheDocument();
            });

            // Should provide retry option
            const retryButton = screen.getByText("Try Again");
            expect(retryButton).toBeInTheDocument();

            await user.click(retryButton);

            // Should attempt to update audio state
            expect(mockActions.updateAudioState).toHaveBeenCalled();
        });
    });

    describe("Settings Configuration Workflows", () => {
        it("should handle settings panel workflow", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            await waitFor(() => {
                expect(screen.getByText("Settings")).toBeInTheDocument();
            });

            // Should show different settings sections
            expect(screen.getByText("General")).toBeInTheDocument();
            expect(screen.getByText("Voice Settings")).toBeInTheDocument();
            expect(screen.getByText("AI Model Configuration")).toBeInTheDocument();

            // Close settings with Escape key
            await user.keyboard("{Escape}");

            await waitFor(() => {
                expect(screen.queryByText("Settings")).not.toBeInTheDocument();
            });
        });

        it("should handle settings changes", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            await waitFor(() => {
                expect(screen.getByText("Settings")).toBeInTheDocument();
            });

            // Change auto-scroll setting
            const autoScrollCheckbox = screen.getByLabelText(/auto-scroll/i);
            await user.click(autoScrollCheckbox);

            // Save changes
            const saveButton = screen.getByText("Save Changes");
            await user.click(saveButton);

            // Should update settings
            expect(mockActions.updateSettings).toHaveBeenCalled();
        });
    });

    describe("Error Handling Workflows", () => {
        it("should handle LangChain initialization errors", async () => {
            // Mock initialization failure
            mockState.langChainState = {
                isInitialized: false,
                currentModel: "",
                conversationId: "",
                tokenCount: 0,
                memorySize: 0,
                isStreaming: false,
            };
            mockState.error = "Failed to initialize AI model";

            mockUseStateManager.mockReturnValue({
                state: mockState,
                ...mockActions,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Model Unavailable")).toBeInTheDocument();
                expect(screen.getByText("Failed to initialize AI model")).toBeInTheDocument();
            });

            // Should provide retry option
            const retryButton = screen.getByText("Try Again");
            await user.click(retryButton);

            expect(mockActions.initializeLangChain).toHaveBeenCalled();
        });

        it("should handle message sending errors", async () => {
            // Mock message sending failure
            mockActions.sendMessage.mockRejectedValueOnce(new Error("Network error"));

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText("Type your message...");
            await user.type(input, "This will fail");
            await user.click(screen.getByLabelText("Send message"));

            // Should attempt to send message
            expect(mockActions.sendMessage).toHaveBeenCalledWith("This will fail", true);
        });

        it("should handle multiple simultaneous errors", async () => {
            // Mock multiple error conditions
            mockState.error = "General system error";
            mockState.audioState = {
                isRecording: false,
                isPlaying: false,
                isSupported: false,
                hasPermission: false,
                error: "Audio system failed",
            };
            mockState.langChainState = {
                isInitialized: false,
                currentModel: "",
                conversationId: "",
                tokenCount: 0,
                memorySize: 0,
                isStreaming: false,
            };

            mockUseStateManager.mockReturnValue({
                state: mockState,
                ...mockActions,
            });

            render(<ChatInterface />);

            // Should show all error states
            await waitFor(() => {
                expect(screen.getByText("General system error")).toBeInTheDocument();
                expect(screen.getByText("Audio Unavailable")).toBeInTheDocument();
                expect(screen.getByText("AI Model Unavailable")).toBeInTheDocument();
            });

            // Should provide recovery options
            expect(screen.getByText("Try Again")).toBeInTheDocument();
            expect(screen.getByLabelText("Dismiss error")).toBeInTheDocument();

            // Core text input should remain functional
            const input = screen.getByPlaceholderText("Type your message...");
            expect(input).toBeInTheDocument();
        });

        it("should handle error dismissal", async () => {
            mockState.error = "Test error message";

            mockUseStateManager.mockReturnValue({
                state: mockState,
                ...mockActions,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("Test error message")).toBeInTheDocument();
            });

            const dismissButton = screen.getByLabelText("Dismiss error message");
            await user.click(dismissButton);

            expect(mockActions.updateError).toHaveBeenCalledWith(undefined);
        });
    });

    describe("Streaming Response Workflows", () => {
        it("should handle streaming conversation", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText("Type your message...");
            await user.type(input, "Stream response please");
            await user.click(screen.getByLabelText("Send message"));

            // Should send message with streaming enabled
            expect(mockActions.sendMessage).toHaveBeenCalledWith("Stream response please", true);

            // Simulate streaming state
            act(() => {
                mockState.langChainState.isStreaming = true;
                mockState.messages = [
                    {
                        id: "1",
                        text: "Stream response please",
                        sender: "user",
                        timestamp: new Date(),
                        status: "sent",
                    },
                    {
                        id: "2",
                        text: "Streaming",
                        sender: "ai",
                        timestamp: new Date(),
                        status: "sending",
                        isStreaming: true,
                    },
                ];
                mockUseStateManager.mockReturnValue({
                    state: mockState,
                    ...mockActions,
                });
            });

            render(<ChatInterface />);

            // Should show streaming indicator
            await waitFor(() => {
                expect(screen.getByLabelText("AI is typing")).toBeInTheDocument();
            });
        });
    });

    describe("Performance and Large Data Handling", () => {
        it("should handle large conversation history", async () => {
            // Generate large conversation
            const largeConversation = Array.from({ length: 100 }, (_, i) => ({
                id: `msg-${i}`,
                text: `Message ${i}: This is a test message`,
                sender: i % 2 === 0 ? "user" : ("ai" as const),
                timestamp: new Date(Date.now() - (100 - i) * 60000),
                status: "sent" as const,
            }));

            mockState.messages = largeConversation;

            mockUseStateManager.mockReturnValue({
                state: mockState,
                ...mockActions,
            });

            const startTime = performance.now();
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const renderTime = performance.now() - startTime;

            // Should render efficiently
            expect(renderTime).toBeLessThan(1000); // 1 second max

            // Should show recent messages
            expect(screen.getByText("Message 99: This is a test message")).toBeInTheDocument();
        });

        it("should handle rapid user interactions", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText("Type your message...");
            const sendButton = screen.getByLabelText("Send message");

            // Rapid message sending
            for (let i = 0; i < 5; i++) {
                await user.clear(input);
                await user.type(input, `Rapid message ${i}`);
                await user.click(sendButton);
            }

            // Should handle all messages
            expect(mockActions.sendMessage).toHaveBeenCalledTimes(5);
        });
    });

    describe("Cross-Browser Feature Detection", () => {
        it("should handle missing Web Speech API gracefully", async () => {
            // Mock browser without speech support
            mockState.audioState = {
                isRecording: false,
                isPlaying: false,
                isSupported: false,
                hasPermission: false,
                error: "Speech recognition not supported",
            };

            mockUseStateManager.mockReturnValue({
                state: mockState,
                ...mockActions,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("Audio Unavailable")).toBeInTheDocument();
                expect(screen.getByText("Speech recognition not supported")).toBeInTheDocument();
            });

            // Text interface should still work
            const input = screen.getByPlaceholderText("Type your message...");
            expect(input).toBeInTheDocument();
            expect(input).not.toBeDisabled();
        });

        it("should handle offline state", async () => {
            // Mock offline state
            Object.defineProperty(navigator, "onLine", {
                value: false,
                writable: true,
            });

            render(<ChatInterface />);

            // Should detect offline state
            fireEvent(window, new Event("offline"));

            await waitFor(() => {
                expect(screen.getByText(/offline/i)).toBeInTheDocument();
            });

            // Restore online state
            Object.defineProperty(navigator, "onLine", {
                value: true,
                writable: true,
            });
        });
    });

    describe("Accessibility Integration", () => {
        it("should maintain accessibility features", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Check ARIA labels
            expect(screen.getByLabelText("Start voice recording")).toBeInTheDocument();
            expect(screen.getByLabelText("Send message")).toBeInTheDocument();

            // Check semantic structure
            const input = screen.getByPlaceholderText("Type your message...");
            expect(input).toHaveAttribute("aria-label");

            // Check role attributes
            const messageList = screen.getByRole("log");
            expect(messageList).toBeInTheDocument();
        });

        it("should support screen reader announcements", async () => {
            mockState.messages = [
                {
                    id: "1",
                    text: "Test message for screen reader",
                    sender: "ai",
                    timestamp: new Date(),
                    status: "sent",
                },
            ];

            mockUseStateManager.mockReturnValue({
                state: mockState,
                ...mockActions,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("Test message for screen reader")).toBeInTheDocument();
            });

            // Message should have proper accessibility attributes
            const message = screen.getByText("Test message for screen reader");
            expect(message.closest(".message-item")).toHaveAttribute("role", "article");
        });
    });
});
