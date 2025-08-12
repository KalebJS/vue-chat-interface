import { useState, useEffect, useCallback, useRef } from "react";
import type { AppState, Message, AudioState, LangChainState, AppSettings } from "../types";
import { MessageStatus } from "../types";
import { StateManager } from "../services/StateManager";
import { LazyLangChainService } from "../services/LazyLangChainService";
import { performanceMonitor } from "../utils/performance";

/**
 * React hook for managing application state with StateManager integration
 */
export function useStateManager() {
    const stateManagerRef = useRef<StateManager | null>(null);
    const langChainServiceRef = useRef<LazyLangChainService | null>(null);

    // Provide a default state while initializing
    const defaultState: AppState = {
        messages: [],
        currentInput: "",
        isLoading: false,
        error: undefined,
        audioState: {
            isRecording: false,
            isPlaying: false,
            isSupported: false,
            hasPermission: false,
            error: undefined,
        },
        langChainState: {
            isInitialized: false,
            currentModel: "",
            conversationId: "",
            tokenCount: 0,
            memorySize: 0,
            isStreaming: false,
        },
        settings: {
            theme: "light",
            fontSize: "medium",
            autoSave: true,
            soundEnabled: true,
            voiceSettings: {
                selectedVoice: "",
                rate: 1,
                pitch: 1,
                volume: 1,
            },
            aiModel: {
                provider: "openai" as any,
                modelName: "gpt-3.5-turbo",
                temperature: 0.7,
                maxTokens: 2048,
                memoryType: "buffer" as any,
                chainType: "conversation" as any,
            },
        },
    };

    const [state, setState] = useState<AppState>(defaultState);

    // Initialize services on first render
    useEffect(() => {
        performanceMonitor.start("useStateManager-init");

        if (!langChainServiceRef.current) {
            langChainServiceRef.current = new LazyLangChainService();
        }

        if (!stateManagerRef.current) {
            stateManagerRef.current = new StateManager(langChainServiceRef.current);
            setState(stateManagerRef.current.getState());
        }

        // Subscribe to state changes
        const unsubscribe = stateManagerRef.current.subscribe((newState) => {
            setState(newState);
        });

        performanceMonitor.end("useStateManager-init");

        // Cleanup on unmount
        return () => {
            unsubscribe();
            if (stateManagerRef.current) {
                stateManagerRef.current.dispose();
            }
            if (langChainServiceRef.current) {
                langChainServiceRef.current.dispose();
            }
        };
    }, []);

    // State update methods
    const updateState = useCallback((updates: Partial<AppState>) => {
        stateManagerRef.current?.setState(updates);
    }, []);

    const updateMessages = useCallback((messages: Message[]) => {
        stateManagerRef.current?.updateMessages(messages);
    }, []);

    const updateCurrentInput = useCallback((input: string) => {
        stateManagerRef.current?.updateCurrentInput(input);
    }, []);

    const updateLoadingState = useCallback((isLoading: boolean) => {
        stateManagerRef.current?.updateLoadingState(isLoading);
    }, []);

    const updateAudioState = useCallback((audioState: Partial<AudioState>) => {
        stateManagerRef.current?.updateAudioState(audioState);
    }, []);

    const updateLangChainState = useCallback((langChainState: Partial<LangChainState>) => {
        stateManagerRef.current?.updateLangChainState(langChainState);
    }, []);

    const updateSettings = useCallback((settings: Partial<AppSettings>) => {
        stateManagerRef.current?.updateSettings(settings);
    }, []);

    const updateError = useCallback((error: string | undefined) => {
        if (stateManagerRef.current && typeof stateManagerRef.current.updateError === "function") {
            stateManagerRef.current.updateError(error);
        } else {
            console.warn("StateManager not initialized or updateError method not available");
        }
    }, []);

    const addMessage = useCallback((message: Omit<Message, "id" | "timestamp">) => {
        stateManagerRef.current?.addMessage(message);
    }, []);

    const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
        stateManagerRef.current?.updateMessage(messageId, updates);
    }, []);

    const clearMessages = useCallback(() => {
        stateManagerRef.current?.clearMessages();
    }, []);

    const loadConversationHistory = useCallback(async () => {
        await stateManagerRef.current?.loadConversationHistory();
    }, []);

    const loadMoreHistory = useCallback(async (beforeMessageId?: string) => {
        return (await stateManagerRef.current?.loadMoreHistory(beforeMessageId)) || [];
    }, []);

    const resetState = useCallback(() => {
        stateManagerRef.current?.resetState();
    }, []);

    const clearPersistedState = useCallback(() => {
        stateManagerRef.current?.clearPersistedState();
    }, []);

    // LangChain service methods
    const initializeLangChain = useCallback(async () => {
        if (!langChainServiceRef.current || !stateManagerRef.current) {
            throw new Error("Services not initialized");
        }

        try {
            updateLoadingState(true);
            updateError(undefined);

            const config = stateManagerRef.current.getState().settings.aiModel;
            await langChainServiceRef.current.init(config);

            // Update LangChain state
            const langChainState = langChainServiceRef.current.getState();
            updateLangChainState(langChainState);

            // Load conversation history
            await loadConversationHistory();
        } catch (error) {
            updateError(error instanceof Error ? error.message : "Failed to initialize LangChain");
            throw error;
        } finally {
            updateLoadingState(false);
        }
    }, [updateLoadingState, updateError, updateLangChainState, loadConversationHistory]);

    const sendMessage = useCallback(async (message: string, enableStreaming: boolean = true) => {
        if (!stateManagerRef.current) {
            throw new Error("State manager not initialized");
        }

        try {
            await stateManagerRef.current.sendMessageWithStreaming(message, enableStreaming);
        } catch (error) {
            // Error handling is done in StateManager
            throw error;
        }
    }, []);

    const sendMessageLegacy = useCallback(
        async (message: string) => {
            if (!langChainServiceRef.current || !stateManagerRef.current) {
                throw new Error("Services not initialized");
            }

            if (!langChainServiceRef.current.isReady()) {
                throw new Error("LangChain service not initialized");
            }

            let userMessageId: string | null = null;

            try {
                updateLoadingState(true);
                updateError(undefined);

                // Add user message with sending status
                const userMessage = {
                    text: message,
                    sender: "user" as const,
                    status: MessageStatus.SENDING,
                };
                addMessage(userMessage);

                // Get the message ID for status updates
                const currentState = stateManagerRef.current.getState();
                const lastMessage = currentState.messages[currentState.messages.length - 1];
                userMessageId = lastMessage?.id || null;

                // Update user message to sent status
                if (userMessageId) {
                    updateMessage(userMessageId, { status: MessageStatus.SENT });
                }

                // Send to LangChain and get response
                const response = await langChainServiceRef.current.sendMessage(message);

                // Add AI response
                addMessage({
                    text: response,
                    sender: "ai",
                    status: MessageStatus.SENT,
                });

                // Update LangChain state
                const langChainState = langChainServiceRef.current.getState();
                updateLangChainState(langChainState);
            } catch (error) {
                // Update user message to error status if we have the ID
                if (userMessageId) {
                    updateMessage(userMessageId, { status: MessageStatus.ERROR });
                }

                const errorMessage = error instanceof Error ? error.message : "Failed to send message";
                updateError(errorMessage);
                throw error;
            } finally {
                updateLoadingState(false);
            }
        },
        [updateLoadingState, updateError, addMessage, updateMessage, updateLangChainState],
    );

    const clearLangChainMemory = useCallback(async () => {
        if (!langChainServiceRef.current) {
            throw new Error("LangChain service not initialized");
        }

        try {
            await langChainServiceRef.current.clearMemory();
            clearMessages();

            // Update LangChain state
            const langChainState = langChainServiceRef.current.getState();
            updateLangChainState(langChainState);
        } catch (error) {
            updateError(error instanceof Error ? error.message : "Failed to clear memory");
            throw error;
        }
    }, [clearMessages, updateLangChainState, updateError]);

    // Settings methods
    const resetSettings = useCallback(() => {
        stateManagerRef.current?.resetSettings();
    }, []);

    const getAvailableVoices = useCallback(() => {
        return stateManagerRef.current?.getAvailableVoices() || [];
    }, []);

    const updateModelConfig = useCallback(
        async (modelConfig: any) => {
            if (!langChainServiceRef.current) {
                throw new Error("LangChain service not initialized");
            }

            try {
                await langChainServiceRef.current.updateModelConfig(modelConfig);

                // Update LangChain state
                const langChainState = langChainServiceRef.current.getState();
                updateLangChainState(langChainState);
            } catch (error) {
                updateError(error instanceof Error ? error.message : "Failed to update model configuration");
                throw error;
            }
        },
        [updateLangChainState, updateError],
    );

    // Debug utilities
    const getDebugInfo = useCallback(() => {
        return {
            stateManager: stateManagerRef.current?.getDebugInfo(),
            langChain: {
                isInitialized: langChainServiceRef.current?.isReady(),
                config: langChainServiceRef.current?.getConfig(),
                state: langChainServiceRef.current?.getState(),
            },
        };
    }, []);

    return {
        // State
        state,

        // State update methods
        updateState,
        updateMessages,
        updateCurrentInput,
        updateLoadingState,
        updateAudioState,
        updateLangChainState,
        updateSettings,
        updateError,

        // Message methods
        addMessage,
        updateMessage,
        clearMessages,

        // Persistence methods
        loadConversationHistory,
        loadMoreHistory,
        resetState,
        clearPersistedState,

        // LangChain methods
        initializeLangChain,
        sendMessage,
        sendMessageLegacy,
        clearLangChainMemory,

        // Settings methods
        resetSettings,
        getAvailableVoices,
        updateModelConfig,

        // Services (for advanced usage)
        stateManager: stateManagerRef.current,
        langChainService: langChainServiceRef.current,

        // Debug utilities
        getDebugInfo,
    };
}

/**
 * Hook for accessing only the state (read-only)
 */
export function useAppState() {
    const { state } = useStateManager();
    return state;
}

/**
 * Hook for accessing specific parts of the state
 */
export function useMessages() {
    const { state } = useStateManager();
    return state?.messages || [];
}

export function useAudioState() {
    const { state } = useStateManager();
    return (
        state?.audioState || {
            isRecording: false,
            isPlaying: false,
            isSupported: false,
            hasPermission: false,
        }
    );
}

export function useLangChainState() {
    const { state } = useStateManager();
    return (
        state?.langChainState || {
            isInitialized: false,
            currentModel: "",
            conversationId: "",
            tokenCount: 0,
            memorySize: 0,
            isStreaming: false,
        }
    );
}

export function useAppSettings() {
    const { state } = useStateManager();
    return state?.settings;
}
