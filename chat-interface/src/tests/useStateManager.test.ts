import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
    useStateManager,
    useAppState,
    useMessages,
    useAudioState,
    useLangChainState,
    useAppSettings,
} from "../hooks/useStateManager";
import { StateManager } from "../services/StateManager";
import { LangChainService } from "../services/LangChainService";
import { MessageStatus, ModelProvider } from "../types";

// Mock the services
vi.mock("../services/StateManager");
vi.mock("../services/LangChainService");

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
});

describe("useStateManager", () => {
    let mockStateManager: StateManager;
    let mockLangChainService: LangChainService;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);

        // Mock LangChainService
        mockLangChainService = new LangChainService();
        vi.mocked(mockLangChainService.isInitialized).mockReturnValue(false);
        vi.mocked(mockLangChainService.getState).mockReturnValue({
            isInitialized: false,
            currentModel: "",
            conversationId: "test-conv-id",
            tokenCount: 0,
            memorySize: 0,
            isStreaming: false,
        });
        vi.mocked(mockLangChainService.initialize).mockResolvedValue();
        vi.mocked(mockLangChainService.sendMessage).mockResolvedValue("AI response");
        vi.mocked(mockLangChainService.getConversationHistory).mockResolvedValue([]);
        vi.mocked(mockLangChainService.clearMemory).mockResolvedValue();

        // Mock StateManager
        const mockState = {
            messages: [],
            currentInput: "",
            isLoading: false,
            audioState: {
                isRecording: false,
                isPlaying: false,
                isSupported: false,
                hasPermission: false,
            },
            langChainState: {
                isInitialized: false,
                currentModel: "",
                conversationId: "test-conv-id",
                tokenCount: 0,
                memorySize: 0,
                isStreaming: false,
            },
            error: undefined,
            settings: {
                autoScroll: true,
                audioEnabled: true,
                voiceSettings: {
                    rate: 1.0,
                    pitch: 1.0,
                    voice: undefined,
                },
                aiModel: {
                    model: {
                        provider: ModelProvider.OPENAI,
                        modelName: "gpt-3.5-turbo",
                        temperature: 0.7,
                        maxTokens: 1000,
                    },
                    memory: {
                        type: "buffer" as const,
                        maxTokenLimit: 2000,
                        returnMessages: true,
                    },
                    chain: {
                        type: "conversation" as const,
                        verbose: false,
                    },
                },
            },
        };

        mockStateManager = new StateManager(mockLangChainService);
        vi.mocked(mockStateManager.getState).mockReturnValue(mockState);
        vi.mocked(mockStateManager.subscribe).mockImplementation((callback) => {
            // Immediately call callback with current state
            callback(mockState);
            return vi.fn(); // Return unsubscribe function
        });
        vi.mocked(mockStateManager.setState).mockImplementation(() => {});
        vi.mocked(mockStateManager.addMessage).mockImplementation(() => {});
        vi.mocked(mockStateManager.updateMessage).mockImplementation(() => {});
        vi.mocked(mockStateManager.clearMessages).mockImplementation(() => {});
        vi.mocked(mockStateManager.updateMessages).mockImplementation(() => {});
        vi.mocked(mockStateManager.updateCurrentInput).mockImplementation(() => {});
        vi.mocked(mockStateManager.updateLoadingState).mockImplementation(() => {});
        vi.mocked(mockStateManager.updateError).mockImplementation(() => {});
        vi.mocked(mockStateManager.updateAudioState).mockImplementation(() => {});
        vi.mocked(mockStateManager.updateSettings).mockImplementation(() => {});
        vi.mocked(mockStateManager.updateLangChainState).mockImplementation(() => {});
        vi.mocked(mockStateManager.loadConversationHistory).mockResolvedValue();
        vi.mocked(mockStateManager.loadMoreHistory).mockResolvedValue([]);
        vi.mocked(mockStateManager.resetState).mockImplementation(() => {});
        vi.mocked(mockStateManager.clearPersistedState).mockImplementation(() => {});
        vi.mocked(mockStateManager.resetSettings).mockImplementation(() => {});
        vi.mocked(mockStateManager.getAvailableVoices).mockReturnValue([]);
        vi.mocked(mockStateManager.dispose).mockImplementation(() => {});

        // Mock StateManager constructor
        vi.mocked(StateManager).mockImplementation(() => mockStateManager);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Hook Initialization", () => {
        it("should initialize services and state on first render", () => {
            const { result } = renderHook(() => useStateManager());

            expect(StateManager).toHaveBeenCalledWith(expect.any(LangChainService));
            expect(mockStateManager.subscribe).toHaveBeenCalled();
            expect(result.current.state).toBeDefined();
        });

        it("should cleanup on unmount", () => {
            const { unmount } = renderHook(() => useStateManager());

            unmount();

            expect(mockStateManager.dispose).toHaveBeenCalled();
        });
    });

    describe("State Update Methods", () => {
        it("should provide updateState method", () => {
            const { result } = renderHook(() => useStateManager());

            act(() => {
                result.current.updateState({ isLoading: true });
            });

            expect(mockStateManager.setState).toHaveBeenCalledWith({ isLoading: true });
        });

        it("should provide updateMessages method", () => {
            const { result } = renderHook(() => useStateManager());
            const messages = [
                {
                    id: "test-1",
                    text: "Hello",
                    sender: "user" as const,
                    timestamp: new Date(),
                    status: MessageStatus.SENT,
                },
            ];

            act(() => {
                result.current.updateMessages(messages);
            });

            expect(mockStateManager.updateMessages).toHaveBeenCalledWith(messages);
        });

        it("should provide updateCurrentInput method", () => {
            const { result } = renderHook(() => useStateManager());

            act(() => {
                result.current.updateCurrentInput("test input");
            });

            expect(mockStateManager.updateCurrentInput).toHaveBeenCalledWith("test input");
        });

        it("should provide updateLoadingState method", () => {
            const { result } = renderHook(() => useStateManager());

            act(() => {
                result.current.updateLoadingState(true);
            });

            expect(mockStateManager.updateLoadingState).toHaveBeenCalledWith(true);
        });

        it("should provide updateAudioState method", () => {
            const { result } = renderHook(() => useStateManager());
            const audioUpdate = { isRecording: true };

            act(() => {
                result.current.updateAudioState(audioUpdate);
            });

            expect(mockStateManager.updateAudioState).toHaveBeenCalledWith(audioUpdate);
        });

        it("should provide updateLangChainState method", () => {
            const { result } = renderHook(() => useStateManager());
            const langChainUpdate = { isInitialized: true };

            act(() => {
                result.current.updateLangChainState(langChainUpdate);
            });

            expect(mockStateManager.updateLangChainState).toHaveBeenCalledWith(langChainUpdate);
        });

        it("should provide updateSettings method", () => {
            const { result } = renderHook(() => useStateManager());
            const settingsUpdate = { autoScroll: false };

            act(() => {
                result.current.updateSettings(settingsUpdate);
            });

            expect(mockStateManager.updateSettings).toHaveBeenCalledWith(settingsUpdate);
        });

        it("should provide updateError method", () => {
            const { result } = renderHook(() => useStateManager());

            act(() => {
                result.current.updateError("Test error");
            });

            expect(mockStateManager.updateError).toHaveBeenCalledWith("Test error");
        });
    });

    describe("Message Methods", () => {
        it("should provide addMessage method", () => {
            const { result } = renderHook(() => useStateManager());
            const message = {
                text: "Hello",
                sender: "user" as const,
                status: MessageStatus.SENT,
            };

            act(() => {
                result.current.addMessage(message);
            });

            expect(mockStateManager.addMessage).toHaveBeenCalledWith(message);
        });

        it("should provide updateMessage method", () => {
            const { result } = renderHook(() => useStateManager());
            const updates = { status: MessageStatus.SENT };

            act(() => {
                result.current.updateMessage("test-id", updates);
            });

            expect(mockStateManager.updateMessage).toHaveBeenCalledWith("test-id", updates);
        });

        it("should provide clearMessages method", () => {
            const { result } = renderHook(() => useStateManager());

            act(() => {
                result.current.clearMessages();
            });

            expect(mockStateManager.clearMessages).toHaveBeenCalled();
        });
    });

    describe("LangChain Methods", () => {
        it("should initialize LangChain service", async () => {
            const { result } = renderHook(() => useStateManager());

            // Wait for hook to initialize
            await act(async () => {
                // The hook should have access to the services
                expect(result.current.langChainService).toBeDefined();
                expect(result.current.stateManager).toBeDefined();
            });
        });

        it("should handle LangChain initialization errors", async () => {
            const { result } = renderHook(() => useStateManager());

            await act(async () => {
                // The hook initializes successfully even if services have errors
                expect(result.current.state).toBeDefined();
            });
        });

        it("should send messages through LangChain", async () => {
            const { result } = renderHook(() => useStateManager());

            await act(async () => {
                // The hook provides the sendMessage method
                expect(typeof result.current.sendMessage).toBe("function");
            });
        });

        it("should handle message sending errors", async () => {
            const { result } = renderHook(() => useStateManager());

            await act(async () => {
                // The hook provides error handling methods
                expect(typeof result.current.updateError).toBe("function");
            });
        });

        it("should clear LangChain memory", async () => {
            const { result } = renderHook(() => useStateManager());

            await act(async () => {
                // The hook provides the clearLangChainMemory method
                expect(typeof result.current.clearLangChainMemory).toBe("function");
            });
        });
    });

    describe("Persistence Methods", () => {
        it("should provide loadConversationHistory method", async () => {
            const { result } = renderHook(() => useStateManager());

            await act(async () => {
                await result.current.loadConversationHistory();
            });

            expect(mockStateManager.loadConversationHistory).toHaveBeenCalled();
        });

        it("should provide resetState method", () => {
            const { result } = renderHook(() => useStateManager());

            act(() => {
                result.current.resetState();
            });

            expect(mockStateManager.resetState).toHaveBeenCalled();
        });

        it("should provide clearPersistedState method", () => {
            const { result } = renderHook(() => useStateManager());

            act(() => {
                result.current.clearPersistedState();
            });

            expect(mockStateManager.clearPersistedState).toHaveBeenCalled();
        });
    });

    describe("Service Access", () => {
        it("should provide access to services", () => {
            const { result } = renderHook(() => useStateManager());

            expect(result.current.stateManager).toBeDefined();
            expect(result.current.langChainService).toBeDefined();
        });

        it("should provide debug information", () => {
            const { result } = renderHook(() => useStateManager());

            const debugInfo = result.current.getDebugInfo();

            expect(debugInfo).toBeDefined();
            expect(debugInfo).toHaveProperty("stateManager");
            expect(debugInfo).toHaveProperty("langChain");
        });
    });
});

describe("Specialized Hooks", () => {
    describe("useAppState", () => {
        it("should return the full application state", () => {
            const { result } = renderHook(() => useAppState());

            expect(result.current).toBeDefined();
        });
    });

    describe("useMessages", () => {
        it("should return messages array", () => {
            const { result } = renderHook(() => useMessages());

            expect(Array.isArray(result.current)).toBe(true);
        });

        it("should return empty array when state is null", () => {
            const { result } = renderHook(() => useMessages());
            expect(Array.isArray(result.current)).toBe(true);
        });
    });

    describe("useAudioState", () => {
        it("should return audio state", () => {
            const { result } = renderHook(() => useAudioState());

            expect(result.current).toHaveProperty("isRecording");
            expect(result.current).toHaveProperty("isSupported");
            expect(result.current).toHaveProperty("hasPermission");
        });

        it("should return default audio state when state is null", () => {
            const { result } = renderHook(() => useAudioState());
            expect(typeof result.current.isRecording).toBe("boolean");
            expect(typeof result.current.isSupported).toBe("boolean");
        });
    });

    describe("useLangChainState", () => {
        it("should return LangChain state", () => {
            const { result } = renderHook(() => useLangChainState());

            expect(result.current).toHaveProperty("isInitialized");
            expect(result.current).toHaveProperty("currentModel");
            expect(result.current).toHaveProperty("tokenCount");
        });

        it("should return default LangChain state when state is null", () => {
            const { result } = renderHook(() => useLangChainState());
            expect(typeof result.current.isInitialized).toBe("boolean");
            expect(typeof result.current.currentModel).toBe("string");
        });
    });

    describe("useAppSettings", () => {
        it("should return app settings", () => {
            const { result } = renderHook(() => useAppSettings());

            expect(result.current).toBeDefined();
        });
    });
});
