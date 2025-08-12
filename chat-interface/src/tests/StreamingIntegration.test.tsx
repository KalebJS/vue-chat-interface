import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatInterface } from "../components/ChatInterface";
import { LangChainService } from "../services/LangChainService";
import { StateManager } from "../services/StateManager";

// Mock the services
vi.mock("../services/LangChainService");
vi.mock("../services/StateManager");
vi.mock("../services/AudioController");

describe("Streaming Integration Tests", () => {
    let mockLangChainService: any;
    let mockStateManager: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock LangChainService
        mockLangChainService = {
            initialize: vi.fn().mockResolvedValue(undefined),
            isInitialized: vi.fn().mockReturnValue(true),
            getState: vi.fn().mockReturnValue({
                isInitialized: true,
                currentModel: "gpt-3.5-turbo",
                conversationId: "test-conv",
                tokenCount: 0,
                memorySize: 0,
                isStreaming: false,
            }),
            sendMessageStreaming: vi.fn().mockImplementation(async (_message, options) => {
                // Simulate streaming tokens
                const words = "Hello there friend".split(" ");
                for (const word of words) {
                    const token = word === words[0] ? word : " " + word;
                    options.onToken?.(token);
                }
                const fullResponse = "Hello there friend";
                options.onComplete?.(fullResponse);
                return fullResponse;
            }),
        };

        // Mock StateManager
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
                settings: {
                    autoScroll: true,
                    audioEnabled: true,
                    voiceSettings: { rate: 1, pitch: 1 },
                    aiModel: {
                        model: { provider: "openai", modelName: "gpt-3.5-turbo", temperature: 0.7, maxTokens: 1000 },
                        memory: { type: "buffer" },
                        chain: { type: "conversation" },
                    },
                },
            }),
            subscribe: vi.fn().mockReturnValue(() => {}),
            sendMessageWithStreaming: vi.fn().mockResolvedValue(undefined),
            updateCurrentInput: vi.fn(),
            updateError: vi.fn(),
            updateAudioState: vi.fn(),
            initializeLangChain: vi.fn().mockResolvedValue(undefined),
            dispose: vi.fn(),
        };

        // Set up the mocks
        vi.mocked(LangChainService).mockImplementation(() => mockLangChainService);
        vi.mocked(StateManager).mockImplementation(() => mockStateManager);
    });

    it("should handle streaming message flow", async () => {
        // Mock a streaming message being added
        const streamingMessage = {
            id: "streaming-1",
            text: "Hello",
            sender: "ai" as const,
            timestamp: new Date(),
            status: "sending" as const,
            isStreaming: true,
            streamingComplete: false,
        };

        // Update mock to return streaming message
        mockStateManager.getState.mockReturnValue({
            ...mockStateManager.getState(),
            messages: [streamingMessage],
            langChainState: {
                ...mockStateManager.getState().langChainState,
                isStreaming: true,
                streamingMessageId: "streaming-1",
            },
        });

        render(<ChatInterface />);

        // Should show streaming indicator
        expect(screen.getByLabelText("AI is typing")).toBeInTheDocument();
        expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    it("should show completed streaming message", async () => {
        // Mock a completed streaming message
        const completedMessage = {
            id: "completed-1",
            text: "Hello there friend",
            sender: "ai" as const,
            timestamp: new Date(),
            status: "sent" as const,
            isStreaming: false,
            streamingComplete: true,
        };

        mockStateManager.getState.mockReturnValue({
            ...mockStateManager.getState(),
            messages: [completedMessage],
        });

        render(<ChatInterface />);

        // Should show completed message without streaming indicator
        expect(screen.queryByLabelText("AI is typing")).not.toBeInTheDocument();
        expect(screen.getByText("Hello there friend")).toBeInTheDocument();
    });

    it("should handle streaming error state", async () => {
        // Mock a streaming error message
        const errorMessage = {
            id: "error-1",
            text: "Partial message",
            sender: "ai" as const,
            timestamp: new Date(),
            status: "error" as const,
            isStreaming: false,
            streamingComplete: false,
        };

        mockStateManager.getState.mockReturnValue({
            ...mockStateManager.getState(),
            messages: [errorMessage],
            error: "Streaming failed",
        });

        render(<ChatInterface />);

        // Should show error state
        expect(screen.getByText("Streaming failed")).toBeInTheDocument();
        expect(screen.getByText("Partial message")).toBeInTheDocument();
        expect(screen.queryByLabelText("AI is typing")).not.toBeInTheDocument();
    });
});
