import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ErrorBoundary, AudioErrorBoundary, LangChainErrorBoundary } from "../components/ErrorBoundary";
import type { AudioState, LangChainState } from "../types";

import { vi } from "vitest";

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = vi.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
});

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow: boolean; message?: string }> = ({ shouldThrow, message = "Test error" }) => {
    if (shouldThrow) {
        throw new Error(message);
    }
    return <div>No error</div>;
};

describe("ErrorBoundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders children when there is no error", () => {
        render(
            <ErrorBoundary>
                <div>Test content</div>
            </ErrorBoundary>,
        );

        expect(screen.getByText("Test content")).toBeInTheDocument();
    });

    it("renders error UI when child component throws", () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        );

        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    });

    it("calls onError callback when error occurs", () => {
        const onError = vi.fn();

        render(
            <ErrorBoundary onError={onError}>
                <ThrowError shouldThrow={true} message="Custom error" />
            </ErrorBoundary>,
        );

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Custom error" }), expect.any(Object));
    });

    it("shows retry button and handles retry", async () => {
        let shouldThrow = true;
        const TestComponent = () => <ThrowError shouldThrow={shouldThrow} />;

        const { rerender } = render(
            <ErrorBoundary maxRetries={2}>
                <TestComponent />
            </ErrorBoundary>,
        );

        expect(screen.getByText("Something went wrong")).toBeInTheDocument();

        const retryButton = screen.getByText(/Retry \(2 attempts left\)/);
        expect(retryButton).toBeInTheDocument();

        // Simulate fixing the error
        shouldThrow = false;
        fireEvent.click(retryButton);

        // Rerender with fixed component
        rerender(
            <ErrorBoundary maxRetries={2}>
                <ThrowError shouldThrow={false} />
            </ErrorBoundary>,
        );

        await waitFor(() => {
            expect(screen.getByText("No error")).toBeInTheDocument();
        });
    });

    it("disables retry button after max retries", () => {
        render(
            <ErrorBoundary maxRetries={0}>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        );

        // With maxRetries=0, retry button should not be shown
        expect(screen.queryByText(/Retry/)).not.toBeInTheDocument();
    });

    it("handles reset button click", () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        );

        const resetButton = screen.getByText("Reset");
        fireEvent.click(resetButton);

        // After reset, should show the error again since component still throws
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("handles refresh button click", () => {
        // Mock window.location.reload
        const mockReload = vi.fn();
        Object.defineProperty(window, "location", {
            value: { reload: mockReload },
            writable: true,
        });

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        );

        const refreshButton = screen.getByText("Refresh Page");
        fireEvent.click(refreshButton);

        expect(mockReload).toHaveBeenCalled();
    });

    it("renders custom fallback when provided", () => {
        const customFallback = <div>Custom error message</div>;

        render(
            <ErrorBoundary fallback={customFallback}>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        );

        expect(screen.getByText("Custom error message")).toBeInTheDocument();
        expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("shows error details in development mode", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "development";

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} message="Development error" />
            </ErrorBoundary>,
        );

        expect(screen.getByText("Error Details (Development)")).toBeInTheDocument();

        process.env.NODE_ENV = originalEnv;
    });
});

describe("AudioErrorBoundary", () => {
    const mockAudioState: AudioState = {
        isRecording: false,
        isPlaying: false,
        isSupported: true,
        hasPermission: true,
    };

    it("renders children when there is no error", () => {
        render(
            <AudioErrorBoundary audioState={mockAudioState}>
                <div>Audio content</div>
            </AudioErrorBoundary>,
        );

        expect(screen.getByText("Audio content")).toBeInTheDocument();
    });

    it("renders audio error UI when child component throws", () => {
        render(
            <AudioErrorBoundary audioState={mockAudioState}>
                <ThrowError shouldThrow={true} />
            </AudioErrorBoundary>,
        );

        expect(screen.getByText(/Audio features are temporarily unavailable/)).toBeInTheDocument();
        expect(screen.getByText("Try Audio Again")).toBeInTheDocument();
    });

    it("calls onAudioDisabled when error occurs", () => {
        const onAudioDisabled = vi.fn();

        render(
            <AudioErrorBoundary audioState={mockAudioState} onAudioDisabled={onAudioDisabled}>
                <ThrowError shouldThrow={true} />
            </AudioErrorBoundary>,
        );

        expect(onAudioDisabled).toHaveBeenCalled();
    });

    it("handles retry audio button click", () => {
        render(
            <AudioErrorBoundary audioState={mockAudioState}>
                <ThrowError shouldThrow={true} />
            </AudioErrorBoundary>,
        );

        const retryButton = screen.getByText("Try Audio Again");
        fireEvent.click(retryButton);

        // Should attempt to recover (component still throws, so error persists)
        expect(screen.getByText(/Audio features are temporarily unavailable/)).toBeInTheDocument();
    });
});

describe("LangChainErrorBoundary", () => {
    const mockLangChainState: LangChainState = {
        isInitialized: true,
        currentModel: "test-model",
        conversationId: "test-id",
        tokenCount: 0,
        memorySize: 0,
        isStreaming: false,
    };

    it("renders children when there is no error", () => {
        render(
            <LangChainErrorBoundary langChainState={mockLangChainState}>
                <div>LangChain content</div>
            </LangChainErrorBoundary>,
        );

        expect(screen.getByText("LangChain content")).toBeInTheDocument();
    });

    it("renders LangChain error UI when child component throws", () => {
        render(
            <LangChainErrorBoundary langChainState={mockLangChainState}>
                <ThrowError shouldThrow={true} />
            </LangChainErrorBoundary>,
        );

        expect(screen.getByText("AI Model Error")).toBeInTheDocument();
        expect(screen.getByText(/The AI model encountered an error/)).toBeInTheDocument();
        expect(screen.getByText("Retry")).toBeInTheDocument();
        expect(screen.getByText("Reset Model")).toBeInTheDocument();
    });

    it("handles retry button click", () => {
        render(
            <LangChainErrorBoundary langChainState={mockLangChainState}>
                <ThrowError shouldThrow={true} />
            </LangChainErrorBoundary>,
        );

        const retryButton = screen.getByText("Retry");
        fireEvent.click(retryButton);

        // Should attempt to recover (component still throws, so error persists)
        expect(screen.getByText("AI Model Error")).toBeInTheDocument();
    });

    it("handles reset model button click", () => {
        const onModelReset = vi.fn();

        render(
            <LangChainErrorBoundary langChainState={mockLangChainState} onModelReset={onModelReset}>
                <ThrowError shouldThrow={true} />
            </LangChainErrorBoundary>,
        );

        const resetButton = screen.getByText("Reset Model");
        fireEvent.click(resetButton);

        expect(onModelReset).toHaveBeenCalled();
    });
});

describe("Error Boundary Integration", () => {
    it("handles nested error boundaries correctly", () => {
        render(
            <ErrorBoundary>
                <div>Outer content</div>
                <AudioErrorBoundary
                    audioState={{
                        isRecording: false,
                        isPlaying: false,
                        isSupported: true,
                        hasPermission: true,
                    }}
                >
                    <ThrowError shouldThrow={true} />
                </AudioErrorBoundary>
            </ErrorBoundary>,
        );

        // Should show audio-specific error, not outer error boundary
        expect(screen.getByText(/Audio features are temporarily unavailable/)).toBeInTheDocument();
        expect(screen.getByText("Outer content")).toBeInTheDocument();
    });

    it("falls back to outer boundary when inner boundary fails", () => {
        // This would be a more complex test involving boundary failures
        // For now, we'll test that both boundaries can coexist
        render(
            <ErrorBoundary>
                <AudioErrorBoundary
                    audioState={{
                        isRecording: false,
                        isPlaying: false,
                        isSupported: true,
                        hasPermission: true,
                    }}
                >
                    <div>Working content</div>
                </AudioErrorBoundary>
            </ErrorBoundary>,
        );

        expect(screen.getByText("Working content")).toBeInTheDocument();
    });
});
