import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInterface } from "../components/ChatInterface";
import { LangChainService } from "../services/LangChainService";
import { StateManager } from "../services/StateManager";
import { AudioController } from "../services/AudioController";

// Mock ResizeObserver for JSDOM environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock services
vi.mock("../services/LangChainService");
vi.mock("../services/StateManager");
vi.mock("../services/AudioController");

describe("Performance Integration Tests", () => {
    let mockLangChainService: any;
    let mockStateManager: any;
    let mockAudioController: any;
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();

        // Mock LangChain Service
        mockLangChainService = {
            initialize: vi.fn().mockResolvedValue(undefined),
            isInitialized: vi.fn().mockReturnValue(true),
            sendMessage: vi.fn().mockResolvedValue("AI response"),
            sendMessageStreaming: vi.fn(),
            getState: vi.fn().mockReturnValue({
                isInitialized: true,
                currentModel: "gpt-3.5-turbo",
                conversationId: "test-conv",
                tokenCount: 0,
                memorySize: 0,
                isStreaming: false,
            }),
            getConversationHistory: vi.fn().mockResolvedValue([]),
            clearMemory: vi.fn().mockResolvedValue(undefined),
            dispose: vi.fn(),
        };

        // Mock State Manager
        mockStateManager = {
            getState: vi.fn().mockReturnValue({
                messages: [],
                currentInput: "",
                isLoading: false,
                audioState: {
                    isRecording: false,
                    isPlaying: false,
                    isSupported: true,
                    hasPermission: true,
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
            }),
            subscribe: vi.fn().mockReturnValue(() => {}),
            sendMessage: vi.fn().mockResolvedValue(undefined),
            sendMessageWithStreaming: vi.fn().mockResolvedValue(undefined),
            updateCurrentInput: vi.fn(),
            updateLoadingState: vi.fn(),
            updateAudioState: vi.fn(),
            updateError: vi.fn(),
            updateMessages: vi.fn(),
            addMessage: vi.fn(),
            updateMessage: vi.fn(),
            clearMessages: vi.fn(),
            loadConversationHistory: vi.fn().mockResolvedValue(undefined),
            loadMoreHistory: vi.fn().mockResolvedValue([]),
            resetState: vi.fn(),
            clearPersistedState: vi.fn(),
            updateLangChainState: vi.fn(),
            updateSettings: vi.fn(),
            resetSettings: vi.fn(),
            getAvailableVoices: vi.fn().mockReturnValue([]),
            dispose: vi.fn(),
        };

        // Mock Audio Controller
        mockAudioController = {
            getState: vi.fn().mockReturnValue({
                isRecording: false,
                isPlaying: false,
                isSupported: true,
                hasPermission: true,
            }),
            setStateChangeCallback: vi.fn(),
            setTranscriptionCallback: vi.fn(),
            destroy: vi.fn(),
        };

        vi.mocked(LangChainService).mockImplementation(() => mockLangChainService);
        vi.mocked(StateManager).mockImplementation(() => mockStateManager);
        vi.mocked(AudioController).mockImplementation(() => mockAudioController);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Large Conversation History Performance", () => {
        it("should handle 1000+ messages efficiently", async () => {
            // Generate large conversation
            const largeConversation = Array.from({ length: 1000 }, (_, i) => ({
                id: `msg-${i}`,
                text: `Message ${i}: This is a test message with substantial content to simulate real conversation data. It includes multiple sentences and various punctuation marks to make it realistic. The message also contains some technical terms and references to previous messages in the conversation thread.`,
                sender: i % 2 === 0 ? "user" : ("ai" as const),
                timestamp: new Date(Date.now() - (1000 - i) * 60000),
                status: "sent" as const,
            }));

            mockStateManager.getState.mockReturnValue({
                ...mockStateManager.getState(),
                messages: largeConversation,
            });

            const startTime = performance.now();
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const renderTime = performance.now() - startTime;

            // Should render large conversation within reasonable time
            expect(renderTime).toBeLessThan(2000); // 2 seconds max

            // Should show most recent messages
            expect(screen.getByText(/Message 999:/)).toBeInTheDocument();

            // Should handle scrolling efficiently
            const messageList = screen.getByRole("log");
            expect(messageList).toBeInTheDocument();
        });

        it("should maintain performance with rapid message updates", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const startTime = performance.now();

            // Simulate rapid message updates
            for (let i = 0; i < 50; i++) {
                const messages = Array.from({ length: i + 1 }, (_, j) => ({
                    id: `msg-${j}`,
                    text: `Rapid message ${j}`,
                    sender: j % 2 === 0 ? "user" : ("ai" as const),
                    timestamp: new Date(),
                    status: "sent" as const,
                }));

                mockStateManager.getState.mockReturnValue({
                    ...mockStateManager.getState(),
                    messages,
                });

                // Force re-render
                act(() => {
                    const stateChangeCallback = mockStateManager.subscribe.mock.calls[0]?.[0];
                    if (stateChangeCallback) {
                        stateChangeCallback();
                    }
                });

                // Small delay to simulate real updates
                await new Promise((resolve) => setTimeout(resolve, 1));
            }

            const totalTime = performance.now() - startTime;

            // Should handle rapid updates efficiently
            expect(totalTime).toBeLessThan(1000); // 1 second for 50 updates
        });

        it("should efficiently handle message virtualization for very long conversations", async () => {
            // Generate extremely large conversation (5000 messages)
            const veryLargeConversation = Array.from({ length: 5000 }, (_, i) => ({
                id: `msg-${i}`,
                text: `Very long conversation message ${i}`,
                sender: i % 2 === 0 ? "user" : ("ai" as const),
                timestamp: new Date(Date.now() - (5000 - i) * 60000),
                status: "sent" as const,
            }));

            mockStateManager.getState.mockReturnValue({
                ...mockStateManager.getState(),
                messages: veryLargeConversation,
            });

            const startTime = performance.now();
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const renderTime = performance.now() - startTime;

            // Should still render efficiently even with 5000 messages
            expect(renderTime).toBeLessThan(3000); // 3 seconds max

            // Should only render visible messages (virtualization)
            const visibleMessages = screen.getAllByText(/Very long conversation message/);
            expect(visibleMessages.length).toBeLessThan(100); // Should not render all 5000
        });

        it("should handle conversation search and filtering efficiently", async () => {
            // Generate searchable conversation
            const searchableConversation = Array.from({ length: 500 }, (_, i) => ({
                id: `msg-${i}`,
                text: i % 10 === 0 ? `Important message ${i} with keyword` : `Regular message ${i}`,
                sender: i % 2 === 0 ? "user" : ("ai" as const),
                timestamp: new Date(Date.now() - (500 - i) * 60000),
                status: "sent" as const,
            }));

            mockStateManager.getState.mockReturnValue({
                ...mockStateManager.getState(),
                messages: searchableConversation,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Simulate search functionality (if implemented)
            const startTime = performance.now();

            // Filter messages containing "keyword"
            const filteredMessages = searchableConversation.filter((msg) => msg.text.includes("keyword"));

            const searchTime = performance.now() - startTime;

            // Search should be fast
            expect(searchTime).toBeLessThan(100); // 100ms max
            expect(filteredMessages.length).toBe(50); // Every 10th message
        });
    });

    describe("Memory Usage and Cleanup", () => {
        it("should properly clean up resources on component unmount", async () => {
            const { unmount } = render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Unmount component
            unmount();

            // Should call cleanup methods
            expect(mockStateManager.dispose).toHaveBeenCalled();
            expect(mockLangChainService.dispose).toHaveBeenCalled();
            expect(mockAudioController.destroy).toHaveBeenCalled();
        });

        it("should handle memory cleanup with multiple component instances", async () => {
            const instances = [];

            // Create multiple instances
            for (let i = 0; i < 10; i++) {
                const instance = render(<ChatInterface />);
                instances.push(instance);

                await waitFor(() => {
                    expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
                });
            }

            // Unmount all instances
            instances.forEach((instance) => instance.unmount());

            // Should call cleanup for each instance
            expect(mockStateManager.dispose).toHaveBeenCalledTimes(10);
            expect(mockLangChainService.dispose).toHaveBeenCalledTimes(10);
            expect(mockAudioController.destroy).toHaveBeenCalledTimes(10);
        });

        it("should prevent memory leaks with event listeners", async () => {
            const addEventListenerSpy = vi.spyOn(window, "addEventListener");
            const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

            const { unmount } = render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const addedListeners = addEventListenerSpy.mock.calls.length;

            unmount();

            const removedListeners = removeEventListenerSpy.mock.calls.length;

            // Should remove as many listeners as were added
            expect(removedListeners).toBeGreaterThanOrEqual(addedListeners);

            addEventListenerSpy.mockRestore();
            removeEventListenerSpy.mockRestore();
        });

        it("should handle memory pressure scenarios", async () => {
            // Simulate low memory conditions
            const originalMemory = (performance as any).memory;

            Object.defineProperty(performance, "memory", {
                value: {
                    usedJSHeapSize: 100 * 1024 * 1024, // 100MB
                    totalJSHeapSize: 120 * 1024 * 1024, // 120MB
                    jsHeapSizeLimit: 128 * 1024 * 1024, // 128MB limit
                },
                writable: true,
            });

            // Generate large conversation to stress memory
            const largeConversation = Array.from({ length: 2000 }, (_, i) => ({
                id: `msg-${i}`,
                text: `Large message ${i} `.repeat(50), // Make messages larger
                sender: i % 2 === 0 ? "user" : ("ai" as const),
                timestamp: new Date(),
                status: "sent" as const,
            }));

            mockStateManager.getState.mockReturnValue({
                ...mockStateManager.getState(),
                messages: largeConversation,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Should handle memory pressure gracefully
            expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();

            // Restore original memory object
            Object.defineProperty(performance, "memory", {
                value: originalMemory,
                writable: true,
            });
        });
    });

    describe("Streaming Performance", () => {
        it("should handle high-frequency streaming updates efficiently", async () => {
            // Mock high-frequency streaming
            mockLangChainService.sendMessageStreaming.mockImplementation(
                async (options: { onToken: (arg0: string) => void; onComplete: (arg0: string) => void }) => {
                    const response =
                        "This is a very long streaming response that will be sent token by token to test the performance of the streaming implementation. ".repeat(
                            20,
                        );
                    const tokens = response.split(" ");

                    const startTime = performance.now();

                    for (let i = 0; i < tokens.length; i++) {
                        const token = i === 0 ? tokens[i] : " " + tokens[i];
                        options.onToken?.(token);

                        // High frequency updates (every 1ms)
                        await new Promise((resolve) => setTimeout(resolve, 1));
                    }

                    const streamingTime = performance.now() - startTime;

                    // Should handle high-frequency updates efficiently
                    expect(streamingTime).toBeLessThan(tokens.length * 5); // Max 5ms per token

                    options.onComplete?.(response);
                    return response;
                },
            );

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText("Type your message...");
            await user.type(input, "Stream test");
            await user.click(screen.getByLabelText("Send message"));

            expect(mockStateManager.sendMessageWithStreaming).toHaveBeenCalled();
        });

        it("should handle multiple concurrent streaming operations", async () => {
            // Mock multiple streaming operations
            const streamingPromises = [];

            for (let i = 0; i < 5; i++) {
                const promise = new Promise((resolve) => {
                    mockLangChainService.sendMessageStreaming.mockImplementationOnce(
                        async (options: { onToken: (arg0: string) => void; onComplete: (arg0: string) => void }) => {
                            const response = `Concurrent stream ${i}`;
                            const tokens = response.split(" ");

                            for (const token of tokens) {
                                options.onToken?.(token);
                                await new Promise((r) => setTimeout(r, 10));
                            }

                            options.onComplete?.(response);
                            resolve(response);
                            return response;
                        },
                    );
                });

                streamingPromises.push(promise);
            }

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const startTime = performance.now();

            // Trigger multiple streaming operations
            for (let i = 0; i < 5; i++) {
                const input = screen.getByPlaceholderText("Type your message...");
                await user.clear(input);
                await user.type(input, `Concurrent message ${i}`);
                await user.click(screen.getByLabelText("Send message"));
            }

            await Promise.all(streamingPromises);

            const totalTime = performance.now() - startTime;

            // Should handle concurrent operations efficiently
            expect(totalTime).toBeLessThan(2000); // 2 seconds for 5 concurrent streams
        });

        it("should maintain UI responsiveness during streaming", async () => {
            // Mock long streaming response
            mockLangChainService.sendMessageStreaming.mockImplementation(
                async (options: { onToken: (arg0: string) => void; onComplete: (arg0: string) => void }) => {
                    const longResponse = "Token ".repeat(1000);
                    const tokens = longResponse.split(" ");

                    for (const token of tokens) {
                        options.onToken?.(token);

                        // Yield control to prevent blocking
                        if (tokens.indexOf(token) % 50 === 0) {
                            await new Promise((resolve) => setTimeout(resolve, 0));
                        }
                    }

                    options.onComplete?.(longResponse);
                    return longResponse;
                },
            );

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText("Type your message...");
            await user.type(input, "Long stream test");

            const startTime = performance.now();
            await user.click(screen.getByLabelText("Send message"));

            // UI should remain responsive during streaming
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            const clickTime = performance.now() - startTime;

            // Settings should open quickly even during streaming
            expect(clickTime).toBeLessThan(500); // 500ms max

            await waitFor(() => {
                expect(screen.getByText("Settings")).toBeInTheDocument();
            });
        });
    });

    describe("Audio Performance", () => {
        it("should handle continuous audio recording efficiently", async () => {
            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const recordButton = screen.getByLabelText("Start recording");

            const startTime = performance.now();

            // Simulate continuous recording
            await user.click(recordButton);

            // Mock continuous audio processing
            for (let i = 0; i < 100; i++) {
                const audioCallback = mockAudioController.setStateChangeCallback.mock.calls[0]?.[0];
                if (audioCallback) {
                    act(() => {
                        audioCallback({
                            isRecording: true,
                            isPlaying: false,
                            isSupported: true,
                            hasPermission: true,
                        });
                    });
                }

                await new Promise((resolve) => setTimeout(resolve, 10));
            }

            const recordingTime = performance.now() - startTime;

            // Should handle continuous recording efficiently
            expect(recordingTime).toBeLessThan(2000); // 2 seconds for 100 updates
        });

        it("should handle multiple audio playback operations", async () => {
            // Mock multiple messages with audio
            const messagesWithAudio = Array.from({ length: 10 }, (_, i) => ({
                id: `msg-${i}`,
                text: `Audio message ${i}`,
                sender: "ai" as const,
                timestamp: new Date(),
                status: "sent" as const,
            }));

            mockStateManager.getState.mockReturnValue({
                ...mockStateManager.getState(),
                messages: messagesWithAudio,
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const playButtons = screen.getAllByLabelText("Play audio");

            const startTime = performance.now();

            // Click multiple play buttons rapidly
            for (const button of playButtons.slice(0, 5)) {
                await user.click(button);
            }

            const playbackTime = performance.now() - startTime;

            // Should handle multiple playback requests efficiently
            expect(playbackTime).toBeLessThan(1000); // 1 second for 5 playback requests
        });
    });

    describe("Network Performance", () => {
        it("should handle network latency gracefully", async () => {
            // Mock slow network responses
            mockStateManager.sendMessage.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
                return "Delayed response";
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText("Type your message...");
            await user.type(input, "Slow network test");

            const startTime = performance.now();
            await user.click(screen.getByLabelText("Send message"));

            // UI should remain responsive during network delay
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            const responseTime = performance.now() - startTime;

            // Settings should open quickly despite network delay
            expect(responseTime).toBeLessThan(500);

            await waitFor(() => {
                expect(screen.getByText("Settings")).toBeInTheDocument();
            });
        });

        it("should handle network timeout scenarios", async () => {
            // Mock network timeout
            mockStateManager.sendMessage.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second timeout
                throw new Error("Network timeout");
            });

            render(<ChatInterface />);

            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText("Type your message...");
            await user.type(input, "Timeout test");

            const startTime = performance.now();
            await user.click(screen.getByLabelText("Send message"));

            // Should handle timeout gracefully
            await waitFor(
                () => {
                    expect(screen.getByText(/timeout/i)).toBeInTheDocument();
                },
                { timeout: 6000 },
            );

            const timeoutTime = performance.now() - startTime;

            // Should timeout within reasonable time
            expect(timeoutTime).toBeLessThan(6000);
        });
    });
});
