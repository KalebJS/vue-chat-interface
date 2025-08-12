import { describe, it, expect } from "vitest";
import {
    type Message,
    type AppState,
    type AudioState,
    type LangChainState,
    type LangChainConfig,
    MessageStatus,
    ModelProvider,
    MemoryType,
    ChainType,
    AudioError,
    LangChainError,
    NetworkError,
    AudioErrorCode,
    LangChainErrorCode,
    NetworkErrorCode,
    isMessage,
    isAudioState,
    isLangChainState,
} from "../types";

describe("Type Definitions", () => {
    describe("Message Interface", () => {
        it("should create a valid Message object", () => {
            const message: Message = {
                id: "123",
                text: "Hello world",
                sender: "user",
                timestamp: new Date(),
                status: MessageStatus.SENT,
            };

            expect(message.id).toBe("123");
            expect(message.text).toBe("Hello world");
            expect(message.sender).toBe("user");
            expect(message.timestamp).toBeInstanceOf(Date);
            expect(message.status).toBe(MessageStatus.SENT);
        });

        it("should allow optional audioUrl property", () => {
            const message: Message = {
                id: "123",
                text: "Hello world",
                sender: "ai",
                timestamp: new Date(),
                status: MessageStatus.SENT,
                audioUrl: "blob:audio-url",
            };

            expect(message.audioUrl).toBe("blob:audio-url");
        });
    });

    describe("AudioState Interface", () => {
        it("should create a valid AudioState object", () => {
            const audioState: AudioState = {
                isRecording: false,
                isPlaying: false,
                isSupported: true,
                hasPermission: true,
            };

            expect(audioState.isRecording).toBe(false);
            expect(audioState.isPlaying).toBe(false);
            expect(audioState.isSupported).toBe(true);
            expect(audioState.hasPermission).toBe(true);
        });

        it("should allow optional error property", () => {
            const audioState: AudioState = {
                isRecording: false,
                isPlaying: false,
                isSupported: false,
                hasPermission: false,
                error: "Microphone not available",
            };

            expect(audioState.error).toBe("Microphone not available");
        });
    });

    describe("LangChainState Interface", () => {
        it("should create a valid LangChainState object", () => {
            const langChainState: LangChainState = {
                isInitialized: true,
                currentModel: "gpt-3.5-turbo",
                conversationId: "conv-123",
                tokenCount: 150,
                memorySize: 5,
                isStreaming: false,
            };

            expect(langChainState.isInitialized).toBe(true);
            expect(langChainState.currentModel).toBe("gpt-3.5-turbo");
            expect(langChainState.conversationId).toBe("conv-123");
            expect(langChainState.tokenCount).toBe(150);
            expect(langChainState.memorySize).toBe(5);
            expect(langChainState.isStreaming).toBe(false);
        });
    });

    describe("LangChainConfig Interface", () => {
        it("should create a valid LangChainConfig object", () => {
            const config: LangChainConfig = {
                model: {
                    provider: ModelProvider.OPENAI,
                    modelName: "gpt-3.5-turbo",
                    temperature: 0.7,
                    maxTokens: 1000,
                },
                memory: {
                    type: MemoryType.BUFFER,
                    maxTokenLimit: 2000,
                    returnMessages: true,
                },
                chain: {
                    type: ChainType.CONVERSATION,
                    verbose: false,
                },
            };

            expect(config.model.provider).toBe(ModelProvider.OPENAI);
            expect(config.model.modelName).toBe("gpt-3.5-turbo");
            expect(config.model.temperature).toBe(0.7);
            expect(config.model.maxTokens).toBe(1000);
            expect(config.memory.type).toBe(MemoryType.BUFFER);
            expect(config.memory.maxTokenLimit).toBe(2000);
            expect(config.memory.returnMessages).toBe(true);
            expect(config.chain.type).toBe(ChainType.CONVERSATION);
            expect(config.chain.verbose).toBe(false);
        });
    });

    describe("AppState Interface", () => {
        it("should create a valid AppState object", () => {
            const appState: AppState = {
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
                    isInitialized: false,
                    currentModel: "",
                    conversationId: "",
                    tokenCount: 0,
                    memorySize: 0,
                    isStreaming: false,
                },
                settings: {
                    autoScroll: true,
                    audioEnabled: true,
                    voiceSettings: {
                        rate: 1.0,
                        pitch: 1.0,
                    },
                    aiModel: {
                        model: {
                            provider: ModelProvider.OPENAI,
                            modelName: "gpt-3.5-turbo",
                            temperature: 0.7,
                            maxTokens: 1000,
                        },
                        memory: {
                            type: MemoryType.BUFFER,
                        },
                        chain: {
                            type: ChainType.CONVERSATION,
                        },
                    },
                },
            };

            expect(appState.messages).toEqual([]);
            expect(appState.currentInput).toBe("");
            expect(appState.isLoading).toBe(false);
            expect(appState.audioState.isSupported).toBe(true);
            expect(appState.langChainState.isInitialized).toBe(false);
            expect(appState.settings.autoScroll).toBe(true);
        });
    });

    describe("Enums", () => {
        it("should have correct MessageStatus values", () => {
            expect(MessageStatus.SENDING).toBe("sending");
            expect(MessageStatus.SENT).toBe("sent");
            expect(MessageStatus.ERROR).toBe("error");
        });

        it("should have correct ModelProvider values", () => {
            expect(ModelProvider.OPENAI).toBe("openai");
            expect(ModelProvider.ANTHROPIC).toBe("anthropic");
            expect(ModelProvider.LOCAL).toBe("local");
        });

        it("should have correct MemoryType values", () => {
            expect(MemoryType.BUFFER).toBe("buffer");
            expect(MemoryType.SUMMARY).toBe("summary");
            expect(MemoryType.VECTOR).toBe("vector");
        });

        it("should have correct ChainType values", () => {
            expect(ChainType.CONVERSATION).toBe("conversation");
            expect(ChainType.RETRIEVAL_QA).toBe("retrieval_qa");
        });
    });

    describe("Error Classes", () => {
        it("should create AudioError with correct properties", () => {
            const error = new AudioError("Microphone access denied", AudioErrorCode.PERMISSION_DENIED);

            expect(error.name).toBe("AudioError");
            expect(error.message).toBe("Microphone access denied");
            expect(error.code).toBe(AudioErrorCode.PERMISSION_DENIED);
            expect(error).toBeInstanceOf(Error);
        });

        it("should create LangChainError with correct properties", () => {
            const error = new LangChainError("Model initialization failed", LangChainErrorCode.INITIALIZATION_FAILED);

            expect(error.name).toBe("LangChainError");
            expect(error.message).toBe("Model initialization failed");
            expect(error.code).toBe(LangChainErrorCode.INITIALIZATION_FAILED);
            expect(error).toBeInstanceOf(Error);
        });

        it("should create NetworkError with correct properties", () => {
            const error = new NetworkError("Connection timeout", NetworkErrorCode.TIMEOUT, 408);

            expect(error.name).toBe("NetworkError");
            expect(error.message).toBe("Connection timeout");
            expect(error.code).toBe(NetworkErrorCode.TIMEOUT);
            expect(error.statusCode).toBe(408);
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("Error Code Enums", () => {
        it("should have correct AudioErrorCode values", () => {
            expect(AudioErrorCode.PERMISSION_DENIED).toBe("PERMISSION_DENIED");
            expect(AudioErrorCode.NOT_SUPPORTED).toBe("NOT_SUPPORTED");
            expect(AudioErrorCode.RECORDING_FAILED).toBe("RECORDING_FAILED");
            expect(AudioErrorCode.PLAYBACK_FAILED).toBe("PLAYBACK_FAILED");
            expect(AudioErrorCode.SPEECH_RECOGNITION_FAILED).toBe("SPEECH_RECOGNITION_FAILED");
            expect(AudioErrorCode.TEXT_TO_SPEECH_FAILED).toBe("TEXT_TO_SPEECH_FAILED");
        });

        it("should have correct LangChainErrorCode values", () => {
            expect(LangChainErrorCode.INITIALIZATION_FAILED).toBe("INITIALIZATION_FAILED");
            expect(LangChainErrorCode.MODEL_NOT_AVAILABLE).toBe("MODEL_NOT_AVAILABLE");
            expect(LangChainErrorCode.CONVERSATION_FAILED).toBe("CONVERSATION_FAILED");
            expect(LangChainErrorCode.MEMORY_ERROR).toBe("MEMORY_ERROR");
            expect(LangChainErrorCode.STREAMING_ERROR).toBe("STREAMING_ERROR");
            expect(LangChainErrorCode.CONFIGURATION_ERROR).toBe("CONFIGURATION_ERROR");
        });

        it("should have correct NetworkErrorCode values", () => {
            expect(NetworkErrorCode.CONNECTION_FAILED).toBe("CONNECTION_FAILED");
            expect(NetworkErrorCode.TIMEOUT).toBe("TIMEOUT");
            expect(NetworkErrorCode.SERVER_ERROR).toBe("SERVER_ERROR");
            expect(NetworkErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
            expect(NetworkErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
        });
    });

    describe("Type Guards", () => {
        describe("isMessage", () => {
            it("should return true for valid Message object", () => {
                const message = {
                    id: "123",
                    text: "Hello",
                    sender: "user",
                    timestamp: new Date(),
                    status: MessageStatus.SENT,
                };

                expect(isMessage(message)).toBe(true);
            });

            it("should return false for invalid Message object", () => {
                const invalidMessage = {
                    id: 123, // should be string
                    text: "Hello",
                    sender: "user",
                    timestamp: new Date(),
                    status: MessageStatus.SENT,
                };

                expect(isMessage(invalidMessage)).toBe(false);
            });

            it("should return false for null or undefined", () => {
                expect(isMessage(null)).toBe(false);
                expect(isMessage(undefined)).toBe(false);
            });
        });

        describe("isAudioState", () => {
            it("should return true for valid AudioState object", () => {
                const audioState = {
                    isRecording: false,
                    isPlaying: false,
                    isSupported: true,
                    hasPermission: true,
                };

                expect(isAudioState(audioState)).toBe(true);
            });

            it("should return false for invalid AudioState object", () => {
                const invalidAudioState = {
                    isRecording: "false", // should be boolean
                    isPlaying: false,
                    isSupported: true,
                    hasPermission: true,
                };

                expect(isAudioState(invalidAudioState)).toBe(false);
            });
        });

        describe("isLangChainState", () => {
            it("should return true for valid LangChainState object", () => {
                const langChainState = {
                    isInitialized: true,
                    currentModel: "gpt-3.5-turbo",
                    conversationId: "conv-123",
                    tokenCount: 150,
                    memorySize: 5,
                    isStreaming: false,
                };

                expect(isLangChainState(langChainState)).toBe(true);
            });

            it("should return false for invalid LangChainState object", () => {
                const invalidLangChainState = {
                    isInitialized: true,
                    currentModel: "gpt-3.5-turbo",
                    conversationId: "conv-123",
                    tokenCount: "150", // should be number
                    memorySize: 5,
                    isStreaming: false,
                };

                expect(isLangChainState(invalidLangChainState)).toBe(false);
            });
        });
    });
});
