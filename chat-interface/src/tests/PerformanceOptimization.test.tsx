import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VirtualizedMessageList } from "../components/VirtualizedMessageList";
import { LazyAudioController } from "../services/LazyAudioController";
import { LazyLangChainService } from "../services/LazyLangChainService";
import { performanceMonitor } from "../utils/performance";
import type { Message, AudioState, VoiceSettings } from "../types";
import { ChainType, MemoryType, MessageStatus, ModelProvider } from "../types";

// Mock performance API
const mockPerformance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
};

Object.defineProperty(global, "performance", {
    value: mockPerformance,
    writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe("Performance Optimizations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        performanceMonitor.clear();
    });

    afterEach(() => {
        performanceMonitor.clear();
    });

    describe("VirtualizedMessageList", () => {
        const mockAudioState: AudioState = {
            isRecording: false,
            isPlaying: false,
            isSupported: true,
            hasPermission: false,
        };

        const mockVoiceSettings: VoiceSettings = {
            rate: 1,
            pitch: 1,
            voice: "default",
        };

        const createMockMessages = (count: number): Message[] => {
            return Array.from({ length: count }, (_, index) => ({
                id: `msg-${index}`,
                text: `Message ${index}`,
                sender: index % 2 === 0 ? "user" : "ai",
                timestamp: new Date(Date.now() - (count - index) * 1000),
                status: MessageStatus.SENT,
            }));
        };

        it("should render all messages when count is below threshold", () => {
            const messages = createMockMessages(10);

            render(
                <VirtualizedMessageList
                    messages={messages}
                    isLoading={false}
                    autoScroll={true}
                    audioState={mockAudioState}
                    voiceSettings={mockVoiceSettings}
                    onPlayAudio={vi.fn()}
                    onPauseAudio={vi.fn()}
                    onResumeAudio={vi.fn()}
                    onStopAudio={vi.fn()}
                    threshold={50}
                />,
            );

            // All messages should be rendered
            messages.forEach((message) => {
                expect(screen.getByText(message.text)).toBeInTheDocument();
            });
        });

        it("should virtualize messages when count exceeds threshold", async () => {
            const messages = createMockMessages(200);

            const { container } = render(
                <VirtualizedMessageList
                    messages={messages}
                    isLoading={false}
                    autoScroll={true}
                    audioState={mockAudioState}
                    voiceSettings={mockVoiceSettings}
                    onPlayAudio={vi.fn()}
                    onPauseAudio={vi.fn()}
                    onResumeAudio={vi.fn()}
                    onStopAudio={vi.fn()}
                    threshold={50}
                    itemHeight={80}
                    overscan={5}
                />,
            );

            // Should have virtualized class
            expect(container.querySelector(".virtualized")).toBeInTheDocument();

            // Not all messages should be rendered (only visible ones + overscan)
            const renderedMessages = container.querySelectorAll('[data-testid="message-item"]');
            expect(renderedMessages.length).toBeLessThan(messages.length);
        });

        it("should handle scroll events efficiently", async () => {
            const messages = createMockMessages(200);
            const onScrollToTop = vi.fn();

            const { container } = render(
                <VirtualizedMessageList
                    messages={messages}
                    isLoading={false}
                    autoScroll={true}
                    audioState={mockAudioState}
                    voiceSettings={mockVoiceSettings}
                    onPlayAudio={vi.fn()}
                    onPauseAudio={vi.fn()}
                    onResumeAudio={vi.fn()}
                    onStopAudio={vi.fn()}
                    onScrollToTop={onScrollToTop}
                    threshold={50}
                />,
            );

            const scrollContainer = container.querySelector(".messages-container");
            expect(scrollContainer).toBeInTheDocument();

            // Simulate scroll to top
            if (scrollContainer) {
                Object.defineProperty(scrollContainer, "scrollTop", { value: 10, writable: true });
                fireEvent.scroll(scrollContainer);
            }

            await waitFor(() => {
                expect(onScrollToTop).toHaveBeenCalled();
            });
        });

        it("should show performance debug info in development", () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "development";

            const messages = createMockMessages(200);

            const { container } = render(
                <VirtualizedMessageList
                    messages={messages}
                    isLoading={false}
                    autoScroll={true}
                    audioState={mockAudioState}
                    voiceSettings={mockVoiceSettings}
                    onPlayAudio={vi.fn()}
                    onPauseAudio={vi.fn()}
                    onResumeAudio={vi.fn()}
                    onStopAudio={vi.fn()}
                    threshold={50}
                />,
            );

            expect(container.querySelector(".virtualization-debug")).toBeInTheDocument();

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe("LazyAudioController", () => {
        it("should not initialize until first use", () => {
            const controller = new LazyAudioController();

            expect(controller.isReady()).toBe(false);
            expect(controller.isLoading()).toBe(false);
        });

        it("should provide basic state without initialization", () => {
            const controller = new LazyAudioController();
            const state = controller.getBasicState();

            expect(state).toEqual({
                isRecording: false,
                isPlaying: false,
                isSupported: expect.any(Boolean),
                hasPermission: false,
                error: undefined,
            });
        });

        it("should check audio support statically", () => {
            const isSupported = LazyAudioController.isAudioSupported();
            expect(typeof isSupported).toBe("boolean");
        });

        it("should initialize on first audio operation", async () => {
            const controller = new LazyAudioController();

            // Mock the dynamic import
            vi.doMock("../services/AudioController", () => ({
                AudioController: vi.fn().mockImplementation(() => ({
                    setStateChangeCallback: vi.fn(),
                    setTranscriptionCallback: vi.fn(),
                    speakText: vi.fn().mockResolvedValue(undefined),
                })),
            }));

            expect(controller.isReady()).toBe(false);

            // This should trigger initialization
            await controller.speakText("test");

            expect(controller.isReady()).toBe(true);
        });

        it("should handle initialization errors gracefully", async () => {
            const controller = new LazyAudioController();

            // Mock failed import
            vi.doMock("../services/AudioController", () => {
                throw new Error("Failed to load AudioController");
            });

            await expect(controller.speakText("test")).rejects.toThrow("Failed to initialize audio controller");
        });

        it("should support preloading", async () => {
            const controller = new LazyAudioController();

            // Mock successful import
            vi.doMock("../services/AudioController", () => ({
                AudioController: vi.fn().mockImplementation(() => ({
                    setStateChangeCallback: vi.fn(),
                    setTranscriptionCallback: vi.fn(),
                })),
            }));

            expect(controller.isReady()).toBe(false);

            // Preload should start initialization
            await controller.preload();

            // Give it time to initialize
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(controller.isReady()).toBe(true);
        });
    });

    describe("LazyLangChainService", () => {
        const mockConfig = {
            model: {
                provider: ModelProvider.OPENAI,
                modelName: "gpt-3.5-turbo",
                temperature: 0.7,
                maxTokens: 1000,
            },
            memory: {
                type: MemoryType.BUFFER,
                returnMessages: true,
            },
            chain: {
                type: ChainType.CONVERSATION,
                verbose: false,
            },
        };

        it("should not initialize until first use", () => {
            const service = new LazyLangChainService();

            expect(service.isReady()).toBe(false);
            expect(service.isLoading()).toBe(false);
        });

        it("should provide basic state without initialization", () => {
            const service = new LazyLangChainService();
            const state = service.getBasicState();

            expect(state).toEqual({
                isInitialized: false,
                currentModel: "",
                conversationId: expect.any(String),
                tokenCount: 0,
                memorySize: 0,
                isStreaming: false,
            });
        });

        it("should initialize on first message", async () => {
            const service = new LazyLangChainService();

            // Mock the dynamic import
            vi.doMock("../services/LangChainService", () => ({
                LangChainService: vi.fn().mockImplementation(() => ({
                    initialize: vi.fn().mockResolvedValue(undefined),
                    sendMessage: vi.fn().mockResolvedValue("Test response"),
                    getState: vi.fn().mockReturnValue({
                        isInitialized: true,
                        currentModel: "openai:gpt-3.5-turbo",
                        conversationId: "test-conv",
                        tokenCount: 10,
                        memorySize: 100,
                        isStreaming: false,
                    }),
                })),
            }));

            expect(service.isReady()).toBe(false);

            // Initialize first
            await service.init(mockConfig);

            // This should trigger initialization
            const response = await service.sendMessage("test message");

            expect(response).toBe("Test response");
            expect(service.isReady()).toBe(true);
        });

        it("should handle initialization errors gracefully", async () => {
            const service = new LazyLangChainService();

            // Mock the dynamic import to throw an error
            vi.doMock("../services/LangChainService", () => {
                throw new Error("Failed to load LangChainService");
            });

            await expect(service.init(mockConfig)).rejects.toThrow("Failed to initialize LangChain service");
            await expect(service.sendMessage("test")).rejects.toThrow("Failed to initialize LangChain service");
        });

        it("should support preloading", async () => {
            const service = new LazyLangChainService();

            // Mock successful import
            vi.doMock("../services/LangChainService", () => ({
                LangChainService: vi.fn().mockImplementation(() => ({
                    initialize: vi.fn().mockResolvedValue(undefined),
                    getState: vi.fn().mockReturnValue({
                        isInitialized: true,
                        currentModel: "openai:gpt-3.5-turbo",
                        conversationId: "test-conv",
                        tokenCount: 0,
                        memorySize: 0,
                        isStreaming: false,
                    }),
                })),
            }));

            expect(service.isReady()).toBe(false);

            // Preload should start initialization
            await service.preload(mockConfig);

            // Give it time to initialize
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(service.isReady()).toBe(true);
        });
    });

    describe("Performance Monitoring", () => {
        it("should track performance metrics", () => {
            performanceMonitor.start("test-operation");

            // Simulate some work
            const startTime = Date.now();
            while (Date.now() - startTime < 10) {
                // Busy wait
            }

            const duration = performanceMonitor.end("test-operation");

            expect(duration).toBeGreaterThan(0);
            expect(performanceMonitor.getMetric("test-operation")).toBeTruthy();
        });

        it("should handle missing metrics gracefully", () => {
            const duration = performanceMonitor.end("non-existent-metric");
            expect(duration).toBeNull();
        });

        it("should clear metrics", () => {
            performanceMonitor.start("test-metric");
            performanceMonitor.end("test-metric");

            expect(performanceMonitor.getMetric("test-metric")).toBeTruthy();

            performanceMonitor.clear();

            expect(performanceMonitor.getMetric("test-metric")).toBeNull();
        });

        it("should get all metrics", () => {
            performanceMonitor.start("metric1");
            performanceMonitor.end("metric1");

            performanceMonitor.start("metric2");
            performanceMonitor.end("metric2");

            const allMetrics = performanceMonitor.getAllMetrics();
            expect(allMetrics).toHaveLength(2);
            expect(allMetrics.map((m) => m.name)).toContain("metric1");
            expect(allMetrics.map((m) => m.name)).toContain("metric2");
        });
    });

    describe("Bundle Size Optimization", () => {
        it("should support dynamic imports", async () => {
            // Test that dynamic imports work
            const modulePromise = import("../utils/performance");
            expect(modulePromise).toBeInstanceOf(Promise);

            const module = await modulePromise;
            expect(module.performanceMonitor).toBeDefined();
        });

        it("should lazy load components", async () => {
            // Test lazy component loading
            const LazyComponent = React.lazy(() =>
                Promise.resolve({
                    default: () => React.createElement("div", { "data-testid": "lazy-component" }, "Lazy loaded"),
                }),
            );

            render(
                <React.Suspense fallback={<div>Loading...</div>}>
                    <LazyComponent />
                </React.Suspense>,
            );

            await waitFor(() => {
                expect(screen.getByTestId("lazy-component")).toBeInTheDocument();
            });
        });
    });

    describe("Memory Management", () => {
        it("should clean up resources properly", () => {
            const controller = new LazyAudioController();
            const service = new LazyLangChainService();

            // These should not throw
            expect(() => controller.destroy()).not.toThrow();
            expect(() => service.dispose()).not.toThrow();
        });

        it("should handle multiple cleanup calls", () => {
            const controller = new LazyAudioController();

            controller.destroy();

            // Second cleanup should not throw
            expect(() => controller.destroy()).not.toThrow();
        });
    });
});
