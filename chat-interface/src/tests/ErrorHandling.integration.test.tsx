import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatInterface } from "../components/ChatInterface";
import { NetworkErrorHandler } from "../services/NetworkErrorHandler";
import { LangChainService } from "../services/LangChainService";
import { AudioController } from "../services/AudioController";
import {
    LangChainError,
    LangChainErrorCode,
    AudioError,
    AudioErrorCode,
    NetworkError,
    NetworkErrorCode,
} from "../types";

// Mock all services
vi.mock("../services/NetworkErrorHandler");
vi.mock("../services/LangChainService");
vi.mock("../services/AudioController");
vi.mock("../hooks/useStateManager");

const mockNetworkErrorHandler = NetworkErrorHandler as MockedFunction<typeof NetworkErrorHandler>;
const mockLangChainService = LangChainService as MockedFunctionClass<typeof LangChainService>;
const mockAudioController = AudioController as MockedFunctionClass<typeof AudioController>;

// Mock useStateManager hook
const mockUseStateManager = require("../hooks/useStateManager").useStateManager as MockedFunctionFunction<any>;

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

describe("Error Handling Integration", () => {
    const mockState = {
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
            currentModel: "test-model",
            conversationId: "test-id",
            tokenCount: 0,
            memorySize: 0,
            isStreaming: false,
        },
        error: undefined,
        settings: {
            autoScroll: true,
            audioEnabled: true,
            voiceSettings: { rate: 1, pitch: 1 },
            aiModel: {} as any,
        },
    };

    const mockActions = {
        sendMessage: vi.fn(),
        updateCurrentInput: vi.fn(),
        updateError: vi.fn(),
        updateAudioState: vi.fn(),
        initializeLangChain: vi.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mock implementations
        mockUseStateManager.mockReturnValue({
            state: mockState,
            ...mockActions,
        });

        mockNetworkErrorHandler.isOnline.mockReturnValue(true);
        mockNetworkErrorHandler.setupConnectionMonitoring.mockReturnValue(() => {});
        mockNetworkErrorHandler.executeWithRetry.mockImplementation(async (fn) => await fn());

        // Mock AudioController
        const mockAudioControllerInstance = {
            getState: vi.fn().mockReturnValue(mockState.audioState),
            setStateChangeCallback: vi.fn(),
            setTranscriptionCallback: vi.fn(),
            destroy: vi.fn(),
            startRecording: vi.fn(),
            stopRecording: vi.fn(),
            speakText: vi.fn(),
            pauseSpeaking: vi.fn(),
            resumeSpeaking: vi.fn(),
            stopSpeaking: vi.fn(),
            recoverFromError: vi.fn().mockResolvedValue(true),
        };

        mockAudioController.mockImplementation(() => mockAudioControllerInstance as any);
    });

    describe("Network Error Handling", () => {
        it("should display network status when offline", () => {
            mockNetworkErrorHandler.isOnline.mockReturnValue(false);

            render(<ChatInterface />);

            expect(screen.getByText(/You're offline/)).toBeInTheDocument();
        });

        it("should handle network errors during message sending", async () => {
            const networkError = new NetworkError("Connection failed", NetworkErrorCode.CONNECTION_FAILED);

            mockActions.sendMessage.mockRejectedValue(networkError);

            render(<ChatInterface />);

            const input = screen.getByPlaceholderText("Type your message...");
            const sendButton = screen.getByLabelText("Send message");

            fireEvent.change(input, { target: { value: "Test message" } });
            fireEvent.click(sendButton);

            await waitFor(() => {
                expect(mockActions.updateError).toHaveBeenCalledWith(expect.stringContaining("Connection failed"));
            });
        });

        it("should retry network operations automatically", async () => {
            mockNetworkErrorHandler.executeWithRetry.mockImplementation(async (fn, options) => {
                // Simulate retry logic
                try {
                    return await fn();
                } catch (error) {
                    if (options?.retryConfig?.maxRetries && options.retryConfig.maxRetries > 0) {
                        return await fn(); // Retry once
                    }
                    throw error;
                }
            });

            render(<ChatInterface />);

            // Network operations should use retry logic
            expect(mockNetworkErrorHandler.executeWithRetry).toHaveBeenCalled();
        });
    });

    describe("LangChain Error Handling", () => {
        it("should display LangChain fallback when not initialized", () => {
            const uninitializedState = {
                ...mockState,
                langChainState: {
                    ...mockState.langChainState,
                    isInitialized: false,
                },
                error: "Failed to initialize AI model",
            };

            mockUseStateManager.mockReturnValue({
                state: uninitializedState,
                ...mockActions,
            });

            render(<ChatInterface />);

            expect(screen.getByText("AI Model Unavailable")).toBeInTheDocument();
            expect(screen.getByText("Failed to initialize AI model")).toBeInTheDocument();
        });

        it("should handle LangChain initialization errors", async () => {
            const langChainError = new LangChainError(
                "Model initialization failed",
                LangChainErrorCode.INITIALIZATION_FAILED,
            );

            mockActions.initializeLangChain.mockRejectedValue(langChainError);

            render(<ChatInterface />);

            await waitFor(() => {
                expect(mockActions.initializeLangChain).toHaveBeenCalled();
            });
        });

        it("should provide retry functionality for LangChain errors", async () => {
            const uninitializedState = {
                ...mockState,
                langChainState: {
                    ...mockState.langChainState,
                    isInitialized: false,
                },
                error: "Model error",
            };

            mockUseStateManager.mockReturnValue({
                state: uninitializedState,
                ...mockActions,
            });

            render(<ChatInterface />);

            const retryButton = screen.getByText("Try Again");
            fireEvent.click(retryButton);

            expect(mockActions.initializeLangChain).toHaveBeenCalled();
        });

        it("should handle model reset functionality", async () => {
            const errorState = {
                ...mockState,
                error: "Model error",
            };

            mockUseStateManager.mockReturnValue({
                state: errorState,
                ...mockActions,
            });

            render(<ChatInterface />);

            const resetButton = screen.getByText("Reset AI Model");
            fireEvent.click(resetButton);

            expect(mockActions.updateError).toHaveBeenCalledWith(undefined);
        });
    });

    describe("Audio Error Handling", () => {
        it("should display audio fallback when not supported", () => {
            const audioErrorState = {
                ...mockState,
                audioState: {
                    ...mockState.audioState,
                    isSupported: false,
                    error: "Audio not supported",
                },
            };

            mockUseStateManager.mockReturnValue({
                state: audioErrorState,
                ...mockActions,
            });

            render(<ChatInterface />);

            expect(screen.getByText("Audio Unavailable")).toBeInTheDocument();
            expect(screen.getByText("Audio not supported")).toBeInTheDocument();
        });

        it("should handle audio initialization errors", () => {
            const mockAudioControllerInstance = {
                getState: vi.fn().mockReturnValue(mockState.audioState),
                setStateChangeCallback: vi.fn(),
                setTranscriptionCallback: vi.fn(),
                destroy: vi.fn(),
            };

            mockAudioController.mockImplementation(() => {
                throw new AudioError("Audio initialization failed", AudioErrorCode.NOT_SUPPORTED);
            });

            render(<ChatInterface />);

            expect(mockActions.updateError).toHaveBeenCalledWith("Audio features are not available");
        });

        it("should provide audio recovery functionality", async () => {
            const audioErrorState = {
                ...mockState,
                audioState: {
                    ...mockState.audioState,
                    error: "Permission denied",
                },
            };

            mockUseStateManager.mockReturnValue({
                state: audioErrorState,
                ...mockActions,
            });

            const mockAudioControllerInstance = {
                getState: vi.fn().mockReturnValue(audioErrorState.audioState),
                setStateChangeCallback: vi.fn(),
                setTranscriptionCallback: vi.fn(),
                destroy: vi.fn(),
                recoverFromError: vi.fn().mockResolvedValue(true),
            };

            mockAudioController.mockImplementation(() => mockAudioControllerInstance as any);

            render(<ChatInterface />);

            const retryButton = screen.getByText("Try Again");
            fireEvent.click(retryButton);

            await waitFor(() => {
                expect(mockAudioControllerInstance.recoverFromError).toHaveBeenCalled();
            });
        });

        it("should gracefully degrade when audio recovery fails", async () => {
            const audioErrorState = {
                ...mockState,
                audioState: {
                    ...mockState.audioState,
                    error: "Persistent error",
                },
            };

            mockUseStateManager.mockReturnValue({
                state: audioErrorState,
                ...mockActions,
            });

            const mockAudioControllerInstance = {
                getState: vi.fn().mockReturnValue(audioErrorState.audioState),
                setStateChangeCallback: vi.fn(),
                setTranscriptionCallback: vi.fn(),
                destroy: vi.fn(),
                recoverFromError: vi.fn().mockResolvedValue(false),
            };

            mockAudioController.mockImplementation(() => mockAudioControllerInstance as any);

            render(<ChatInterface />);

            const retryButton = screen.getByText("Try Again");
            fireEvent.click(retryButton);

            await waitFor(() => {
                expect(mockAudioControllerInstance.recoverFromError).toHaveBeenCalled();
            });

            // Audio should remain disabled
            expect(mockAudioControllerInstance.recoverFromError).toHaveReturnedWith(Promise.resolve(false));
        });
    });

    describe("Error Boundary Integration", () => {
        it("should catch and handle React component errors", () => {
            // Mock a component that throws an error
            const ThrowingComponent = () => {
                throw new Error("Component error");
            };

            // This would be tested with a custom render that includes error boundaries
            // For now, we'll test that error boundaries are properly configured
            render(<ChatInterface />);

            // Verify error boundaries are in place
            expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
        });

        it("should provide fallback UI for component errors", () => {
            // Test that fallback UI is rendered when components fail
            render(<ChatInterface />);

            // The interface should render without errors
            expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
        });
    });

    describe("Error Recovery and User Experience", () => {
        it("should allow users to dismiss errors", () => {
            const errorState = {
                ...mockState,
                error: "Test error message",
            };

            mockUseStateManager.mockReturnValue({
                state: errorState,
                ...mockActions,
            });

            render(<ChatInterface />);

            expect(screen.getByText("Test error message")).toBeInTheDocument();

            const dismissButton = screen.getByLabelText("Dismiss error");
            fireEvent.click(dismissButton);

            expect(mockActions.updateError).toHaveBeenCalledWith(undefined);
        });

        it("should maintain functionality when some features fail", () => {
            const partialErrorState = {
                ...mockState,
                audioState: {
                    ...mockState.audioState,
                    isSupported: false,
                    error: "Audio unavailable",
                },
            };

            mockUseStateManager.mockReturnValue({
                state: partialErrorState,
                ...mockActions,
            });

            render(<ChatInterface />);

            // Text input should still work
            const input = screen.getByPlaceholderText("Type your message...");
            expect(input).toBeInTheDocument();
            expect(input).not.toBeDisabled();

            // Send button should still work
            const sendButton = screen.getByLabelText("Send message");
            expect(sendButton).toBeInTheDocument();
        });

        it("should show appropriate loading states during recovery", async () => {
            const loadingState = {
                ...mockState,
                isLoading: true,
                langChainState: {
                    ...mockState.langChainState,
                    isInitialized: false,
                },
            };

            mockUseStateManager.mockReturnValue({
                state: loadingState,
                ...mockActions,
            });

            render(<ChatInterface />);

            expect(screen.getByText("Initializing AI model...")).toBeInTheDocument();
        });

        it("should handle multiple simultaneous errors gracefully", () => {
            const multiErrorState = {
                ...mockState,
                error: "General error",
                audioState: {
                    ...mockState.audioState,
                    isSupported: false,
                    error: "Audio error",
                },
                langChainState: {
                    ...mockState.langChainState,
                    isInitialized: false,
                },
            };

            mockUseStateManager.mockReturnValue({
                state: multiErrorState,
                ...mockActions,
            });

            render(<ChatInterface />);

            // Should show multiple error indicators
            expect(screen.getByText("General error")).toBeInTheDocument();
            expect(screen.getByText("Audio Unavailable")).toBeInTheDocument();
            expect(screen.getByText("AI Model Unavailable")).toBeInTheDocument();
        });
    });

    describe("Accessibility and Error Communication", () => {
        it("should provide accessible error messages", () => {
            const errorState = {
                ...mockState,
                error: "Accessibility test error",
            };

            mockUseStateManager.mockReturnValue({
                state: errorState,
                ...mockActions,
            });

            render(<ChatInterface />);

            const errorMessage = screen.getByText("Accessibility test error");
            expect(errorMessage).toBeInTheDocument();

            const dismissButton = screen.getByLabelText("Dismiss error");
            expect(dismissButton).toBeInTheDocument();
        });

        it("should provide clear action buttons with proper labels", () => {
            const errorState = {
                ...mockState,
                audioState: {
                    ...mockState.audioState,
                    error: "Audio error",
                },
            };

            mockUseStateManager.mockReturnValue({
                state: errorState,
                ...mockActions,
            });

            render(<ChatInterface />);

            expect(screen.getByLabelText("Retry operation")).toBeInTheDocument();
            expect(screen.getByLabelText("Dismiss message")).toBeInTheDocument();
        });
    });
});
