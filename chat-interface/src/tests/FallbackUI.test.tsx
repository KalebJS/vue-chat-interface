import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { FallbackUI, AudioFallback, LangChainFallback, NetworkStatus, LoadingFallback } from "../components/FallbackUI";
import type { AudioState, LangChainState } from "../types";

describe("FallbackUI", () => {
    it("renders audio fallback UI", () => {
        render(<FallbackUI type="audio" error="Microphone not available" />);

        expect(screen.getByText("Audio Unavailable")).toBeInTheDocument();
        expect(screen.getByText(/Audio features are not available/)).toBeInTheDocument();
        expect(screen.getByText("Microphone not available")).toBeInTheDocument();
    });

    it("renders langchain fallback UI", () => {
        render(<FallbackUI type="langchain" error="Model initialization failed" />);

        expect(screen.getByText("AI Model Unavailable")).toBeInTheDocument();
        expect(screen.getByText(/The AI model is currently unavailable/)).toBeInTheDocument();
        expect(screen.getByText("Model initialization failed")).toBeInTheDocument();
    });

    it("renders network fallback UI", () => {
        render(<FallbackUI type="network" error="Connection timeout" />);

        expect(screen.getByText("Connection Issue")).toBeInTheDocument();
        expect(screen.getByText(/Unable to connect to the service/)).toBeInTheDocument();
        expect(screen.getByText("Connection timeout")).toBeInTheDocument();
    });

    it("renders general fallback UI", () => {
        render(<FallbackUI type="general" error="Unknown error" />);

        expect(screen.getByText("Service Unavailable")).toBeInTheDocument();
        expect(screen.getByText(/A service is temporarily unavailable/)).toBeInTheDocument();
        expect(screen.getByText("Unknown error")).toBeInTheDocument();
    });

    it("shows suggestions for each fallback type", () => {
        render(<FallbackUI type="audio" />);

        expect(screen.getByText("Suggestions:")).toBeInTheDocument();
        expect(screen.getByText(/Make sure you're using a modern browser/)).toBeInTheDocument();
        expect(screen.getByText(/Grant microphone permission/)).toBeInTheDocument();
        expect(screen.getByText(/secure \(HTTPS\) connection/)).toBeInTheDocument();
    });

    it("handles retry button click", () => {
        const onRetry = vi.fn();

        render(<FallbackUI type="network" onRetry={onRetry} />);

        const retryButton = screen.getByText("Try Again");
        fireEvent.click(retryButton);

        expect(onRetry).toHaveBeenCalled();
    });

    it("handles dismiss button click", () => {
        const onDismiss = vi.fn();

        render(<FallbackUI type="audio" onDismiss={onDismiss} />);

        const dismissButton = screen.getByText("Dismiss");
        fireEvent.click(dismissButton);

        expect(onDismiss).toHaveBeenCalled();
    });

    it("does not show buttons when callbacks are not provided", () => {
        render(<FallbackUI type="general" />);

        expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
        expect(screen.queryByText("Dismiss")).not.toBeInTheDocument();
    });

    it("applies custom className", () => {
        const { container } = render(<FallbackUI type="audio" className="custom-class" />);

        expect(container.firstChild).toHaveClass("custom-class");
    });
});

describe("AudioFallback", () => {
    const mockAudioState: AudioState = {
        isRecording: false,
        isPlaying: false,
        isSupported: true,
        hasPermission: true,
    };

    it("renders nothing when audio is supported and no error", () => {
        const { container } = render(<AudioFallback audioState={mockAudioState} />);

        expect(container.firstChild).toBeNull();
    });

    it("renders fallback when audio is not supported", () => {
        const audioState = { ...mockAudioState, isSupported: false };

        render(<AudioFallback audioState={audioState} />);

        expect(screen.getByText("Audio Unavailable")).toBeInTheDocument();
    });

    it("renders fallback when there is an audio error", () => {
        const audioState = { ...mockAudioState, error: "Permission denied" };

        render(<AudioFallback audioState={audioState} />);

        expect(screen.getByText("Audio Unavailable")).toBeInTheDocument();
        expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });

    it("handles retry callback", () => {
        const onRetry = vi.fn();
        const audioState = { ...mockAudioState, error: "Test error" };

        render(<AudioFallback audioState={audioState} onRetry={onRetry} />);

        const retryButton = screen.getByText("Try Again");
        fireEvent.click(retryButton);

        expect(onRetry).toHaveBeenCalled();
    });

    it("handles dismiss callback", () => {
        const onDismiss = vi.fn();
        const audioState = { ...mockAudioState, error: "Test error" };

        render(<AudioFallback audioState={audioState} onDismiss={onDismiss} />);

        const dismissButton = screen.getByText("Dismiss");
        fireEvent.click(dismissButton);

        expect(onDismiss).toHaveBeenCalled();
    });
});

describe("LangChainFallback", () => {
    const mockLangChainState: LangChainState = {
        isInitialized: true,
        currentModel: "test-model",
        conversationId: "test-id",
        tokenCount: 0,
        memorySize: 0,
        isStreaming: false,
    };

    it("renders nothing when initialized and no error", () => {
        const { container } = render(<LangChainFallback langChainState={mockLangChainState} />);

        expect(container.firstChild).toBeNull();
    });

    it("renders fallback when not initialized", () => {
        const langChainState = { ...mockLangChainState, isInitialized: false };

        render(<LangChainFallback langChainState={langChainState} error="Initialization failed" />);

        expect(screen.getByText("AI Model Unavailable")).toBeInTheDocument();
        expect(screen.getByText("Initialization failed")).toBeInTheDocument();
    });

    it("renders fallback when there is an error", () => {
        render(<LangChainFallback langChainState={mockLangChainState} error="Model error" />);

        expect(screen.getByText("AI Model Unavailable")).toBeInTheDocument();
        expect(screen.getByText("Model error")).toBeInTheDocument();
    });

    it("handles retry callback", () => {
        const onRetry = vi.fn();

        render(<LangChainFallback langChainState={mockLangChainState} error="Test error" onRetry={onRetry} />);

        const retryButton = screen.getByText("Try Again");
        fireEvent.click(retryButton);

        expect(onRetry).toHaveBeenCalled();
    });

    it("handles reset callback", () => {
        const onReset = vi.fn();

        render(<LangChainFallback langChainState={mockLangChainState} error="Test error" onReset={onReset} />);

        const resetButton = screen.getByText("Reset AI Model");
        fireEvent.click(resetButton);

        expect(onReset).toHaveBeenCalled();
    });

    it("shows reset button even without error when callback provided", () => {
        const onReset = vi.fn();
        const langChainState = { ...mockLangChainState, isInitialized: false };

        render(<LangChainFallback langChainState={langChainState} onReset={onReset} />);

        expect(screen.getByText("Reset AI Model")).toBeInTheDocument();
    });
});

describe("NetworkStatus", () => {
    it("renders nothing when online", () => {
        const { container } = render(<NetworkStatus isOnline={true} />);

        expect(container.firstChild).toBeNull();
    });

    it("renders offline status when offline", () => {
        render(<NetworkStatus isOnline={false} />);

        expect(screen.getByText(/You're offline/)).toBeInTheDocument();
        expect(screen.getByText(/Messages will be sent when connection is restored/)).toBeInTheDocument();
    });

    it("applies custom className", () => {
        const { container } = render(<NetworkStatus isOnline={false} className="custom-network-class" />);

        expect(container.firstChild).toHaveClass("custom-network-class");
    });
});

describe("LoadingFallback", () => {
    it("renders default loading message", () => {
        render(<LoadingFallback />);

        expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("renders custom loading message", () => {
        render(<LoadingFallback message="Initializing AI model..." />);

        expect(screen.getByText("Initializing AI model...")).toBeInTheDocument();
    });

    it("applies custom className", () => {
        const { container } = render(<LoadingFallback className="custom-loading-class" />);

        expect(container.firstChild).toHaveClass("custom-loading-class");
    });

    it("shows loading spinner", () => {
        const { container } = render(<LoadingFallback />);

        expect(container.querySelector(".loading-fallback__spinner")).toBeInTheDocument();
        expect(container.querySelector(".loading-fallback__spinner-inner")).toBeInTheDocument();
    });
});

describe("Accessibility", () => {
    it("has proper ARIA labels for buttons", () => {
        render(<FallbackUI type="audio" onRetry={() => {}} onDismiss={() => {}} />);

        expect(screen.getByLabelText("Retry operation")).toBeInTheDocument();
        expect(screen.getByLabelText("Dismiss message")).toBeInTheDocument();
    });

    it("has proper ARIA labels for LangChain buttons", () => {
        const mockLangChainState: LangChainState = {
            isInitialized: false,
            currentModel: "",
            conversationId: "",
            tokenCount: 0,
            memorySize: 0,
            isStreaming: false,
        };

        render(
            <LangChainFallback
                langChainState={mockLangChainState}
                error="Test error"
                onRetry={() => {}}
                onReset={() => {}}
            />,
        );

        expect(screen.getByLabelText("Retry operation")).toBeInTheDocument();
        expect(screen.getByLabelText("Reset AI model")).toBeInTheDocument();
    });

    it("maintains focus management", () => {
        render(<FallbackUI type="network" onRetry={() => {}} />);

        const retryButton = screen.getByText("Try Again");
        retryButton.focus();

        expect(document.activeElement).toBe(retryButton);
    });
});

describe("Responsive behavior", () => {
    it("renders properly on different screen sizes", () => {
        // This would typically involve testing with different viewport sizes
        // For now, we'll just ensure the components render without errors
        const { container } = render(<FallbackUI type="audio" onRetry={() => {}} onDismiss={() => {}} />);

        expect(container.firstChild).toHaveClass("fallback-ui");
        expect(container.firstChild).toHaveClass("fallback-ui--audio");
    });
});
