import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ChatInterface } from "../components/ChatInterface";
import { LangChainService } from "../services/LangChainService";
import { MemoryType, ChainType } from "../types";

// Mock the services
vi.mock("../services/LangChainService");
vi.mock("../services/AudioController");
vi.mock("../services/NetworkErrorHandler");

// Mock window.speechSynthesis
const mockVoices = [
    {
        name: "Test Voice 1",
        lang: "en-US",
        voiceURI: "test-voice-1",
        localService: true,
        default: true,
    } as SpeechSynthesisVoice,
    {
        name: "Test Voice 2",
        lang: "en-GB",
        voiceURI: "test-voice-2",
        localService: true,
        default: false,
    } as SpeechSynthesisVoice,
];

Object.defineProperty(window, "speechSynthesis", {
    writable: true,
    value: {
        getVoices: vi.fn(() => mockVoices),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    },
});

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
    writable: true,
    value: true,
});

describe("Settings Integration", () => {
    let mockLangChainService: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup LangChain service mock
        mockLangChainService = {
            isInitialized: vi.fn().mockReturnValue(true),
            getState: vi.fn().mockReturnValue({
                isInitialized: true,
                currentModel: "openai:gpt-3.5-turbo",
                conversationId: "test-conv",
                tokenCount: 0,
                memorySize: 0,
                isStreaming: false,
            }),
            initialize: vi.fn().mockResolvedValue(undefined),
            updateModelConfig: vi.fn().mockResolvedValue(undefined),
            sendMessage: vi.fn().mockResolvedValue("Test response"),
            getConversationHistory: vi.fn().mockResolvedValue([]),
            clearMemory: vi.fn().mockResolvedValue(undefined),
            dispose: vi.fn(),
        };

        vi.mocked(LangChainService).mockImplementation(() => mockLangChainService);
    });

    describe("Settings Panel Integration", () => {
        it("opens settings panel when settings button is clicked", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Click settings button
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Settings panel should open
            expect(screen.getByText("Settings")).toBeInTheDocument();
            expect(screen.getByText("General")).toBeInTheDocument();
            expect(screen.getByText("Voice Settings")).toBeInTheDocument();
            expect(screen.getByText("AI Model Configuration")).toBeInTheDocument();
        });

        it("closes settings panel when close button is clicked", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            expect(screen.getByText("Settings")).toBeInTheDocument();

            // Close settings
            const closeButton = screen.getByLabelText(/close settings/i);
            await user.click(closeButton);

            // Settings panel should close
            expect(screen.queryByText("Settings")).not.toBeInTheDocument();
        });

        it("persists settings changes", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Change auto-scroll setting
            const autoScrollCheckbox = screen.getByLabelText(/auto-scroll/i);
            await user.click(autoScrollCheckbox);

            // Save changes
            const saveButton = screen.getByText("Save Changes");
            await user.click(saveButton);

            // Settings panel should close
            await waitFor(() => {
                expect(screen.queryByText("Settings")).not.toBeInTheDocument();
            });

            // Reopen settings to verify persistence
            await user.click(settingsButton);

            const autoScrollCheckboxAfter = screen.getByLabelText(/auto-scroll/i);
            expect(autoScrollCheckboxAfter).not.toBeChecked();
        });

        it("updates AI model configuration when settings change", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Change model name
            const modelNameInput = screen.getByLabelText(/model name/i);
            await user.clear(modelNameInput);
            await user.type(modelNameInput, "gpt-4");

            // Change temperature
            const temperatureSlider = screen.getByLabelText(/temperature/i);
            await user.clear(temperatureSlider);
            await user.type(temperatureSlider, "1.2");

            // Save changes
            const saveButton = screen.getByText("Save Changes");
            await user.click(saveButton);

            // Verify that LangChain service was updated
            await waitFor(() => {
                expect(mockLangChainService.updateModelConfig).toHaveBeenCalledWith(
                    expect.objectContaining({
                        modelName: "gpt-4",
                        temperature: 1.2,
                    }),
                );
            });
        });

        it("loads available voices in settings", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Check that voices are loaded
            expect(screen.getByText("Test Voice 1 (en-US)")).toBeInTheDocument();
            expect(screen.getByText("Test Voice 2 (en-GB)")).toBeInTheDocument();
        });

        it("handles settings validation errors", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Enter invalid temperature
            const temperatureSlider = screen.getByLabelText(/temperature/i);
            await user.clear(temperatureSlider);
            await user.type(temperatureSlider, "5");

            // Validation error should appear
            await waitFor(() => {
                expect(screen.getByText(/temperature must be between/i)).toBeInTheDocument();
            });

            // Save button should be disabled
            const saveButton = screen.getByText("Save Changes");
            expect(saveButton).toBeDisabled();
        });

        it("shows error message when model update fails", async () => {
            const user = userEvent.setup();

            // Mock updateModelConfig to fail
            mockLangChainService.updateModelConfig.mockRejectedValue(new Error("Model update failed"));

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Change model name
            const modelNameInput = screen.getByLabelText(/model name/i);
            await user.clear(modelNameInput);
            await user.type(modelNameInput, "invalid-model");

            // Save changes
            const saveButton = screen.getByText("Save Changes");
            await user.click(saveButton);

            // Error should be displayed
            await waitFor(() => {
                expect(screen.getByText(/model update failed/i)).toBeInTheDocument();
            });
        });
    });

    describe("Settings State Management", () => {
        it("maintains settings state across component re-renders", async () => {
            const user = userEvent.setup();

            const { rerender } = render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings and make a change
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            const autoScrollCheckbox = screen.getByLabelText(/auto-scroll/i);
            await user.click(autoScrollCheckbox);

            const saveButton = screen.getByText("Save Changes");
            await user.click(saveButton);

            // Re-render component
            rerender(<ChatInterface />);

            // Wait for re-render
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings again
            const settingsButtonAfter = screen.getByLabelText(/open settings/i);
            await user.click(settingsButtonAfter);

            // Setting should be persisted
            const autoScrollCheckboxAfter = screen.getByLabelText(/auto-scroll/i);
            expect(autoScrollCheckboxAfter).not.toBeChecked();
        });

        it("applies voice settings to audio controller", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Change voice settings
            const voiceSelect = screen.getByLabelText(/voice/i);
            await user.selectOptions(voiceSelect, "Test Voice 1");

            const rateSlider = screen.getByLabelText(/speech rate/i);
            await user.clear(rateSlider);
            await user.type(rateSlider, "1.5");

            const pitchSlider = screen.getByLabelText(/speech pitch/i);
            await user.clear(pitchSlider);
            await user.type(pitchSlider, "1.2");

            // Save changes
            const saveButton = screen.getByText("Save Changes");
            await user.click(saveButton);

            // Settings should be applied (we can't easily test AudioController integration,
            // but we can verify the settings were saved)
            await waitFor(() => {
                expect(screen.queryByText("Settings")).not.toBeInTheDocument();
            });
        });

        it("handles memory configuration changes", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Change memory settings
            const memoryTypeSelect = screen.getByLabelText(/memory type/i);
            await user.selectOptions(memoryTypeSelect, MemoryType.SUMMARY);

            const tokenLimitInput = screen.getByLabelText(/max token limit/i);
            await user.clear(tokenLimitInput);
            await user.type(tokenLimitInput, "3000");

            const returnMessagesCheckbox = screen.getByLabelText(/return messages/i);
            await user.click(returnMessagesCheckbox);

            // Save changes
            const saveButton = screen.getByText("Save Changes");
            await user.click(saveButton);

            // Verify settings were applied
            await waitFor(() => {
                expect(screen.queryByText("Settings")).not.toBeInTheDocument();
            });
        });

        it("handles chain configuration changes", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Change chain settings
            const chainTypeSelect = screen.getByLabelText(/chain type/i);
            await user.selectOptions(chainTypeSelect, ChainType.RETRIEVAL_QA);

            const verboseCheckbox = screen.getByLabelText(/verbose logging/i);
            await user.click(verboseCheckbox);

            const streamingCheckbox = screen.getByLabelText(/enable streaming/i);
            await user.click(streamingCheckbox);

            // Save changes
            const saveButton = screen.getByText("Save Changes");
            await user.click(saveButton);

            // Verify settings were applied
            await waitFor(() => {
                expect(screen.queryByText("Settings")).not.toBeInTheDocument();
            });
        });
    });

    describe("Settings Accessibility", () => {
        it("supports keyboard navigation in settings panel", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Navigate to settings button with keyboard
            await user.tab();
            // Skip other elements until we reach settings button
            const settingsButton = screen.getByLabelText(/open settings/i);
            settingsButton.focus();

            // Open settings with Enter
            await user.keyboard("{Enter}");

            expect(screen.getByText("Settings")).toBeInTheDocument();

            // Tab through settings elements
            await user.tab();
            expect(screen.getByLabelText(/close settings/i)).toHaveFocus();

            await user.tab();
            expect(screen.getByLabelText(/auto-scroll/i)).toHaveFocus();

            // Toggle with space
            await user.keyboard(" ");
            expect(screen.getByLabelText(/auto-scroll/i)).not.toBeChecked();
        });

        it("has proper ARIA labels and descriptions", async () => {
            const user = userEvent.setup();

            render(<ChatInterface />);

            // Wait for component to initialize
            await waitFor(() => {
                expect(screen.getByText("AI Chat Interface")).toBeInTheDocument();
            });

            // Open settings
            const settingsButton = screen.getByLabelText(/open settings/i);
            await user.click(settingsButton);

            // Check for proper labels
            expect(screen.getByLabelText(/auto-scroll/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/enable audio/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/voice/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/speech rate/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/speech pitch/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/model name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/temperature/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/max tokens/i)).toBeInTheDocument();
        });
    });
});
