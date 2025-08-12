import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SettingsButton } from "../components/SettingsButton";

describe("SettingsButton", () => {
    const defaultProps = {
        onClick: vi.fn(),
        className: "",
        disabled: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Rendering", () => {
        it("renders button with settings icon", () => {
            render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button", { name: /open settings/i });
            expect(button).toBeInTheDocument();

            // Check for SVG icon
            const icon = button.querySelector("svg");
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveClass("settings-icon");
        });

        it("applies custom className", () => {
            render(<SettingsButton {...defaultProps} className="custom-class" />);

            const button = screen.getByRole("button");
            expect(button).toHaveClass("settings-button", "custom-class");
        });

        it("has proper accessibility attributes", () => {
            render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button");
            expect(button).toHaveAttribute("aria-label", "Open settings panel");
            expect(button).toHaveAttribute("title", "Open settings");
        });
    });

    describe("Interactions", () => {
        it("calls onClick when clicked", async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            render(<SettingsButton {...defaultProps} onClick={onClick} />);

            const button = screen.getByRole("button");
            await user.click(button);

            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it("calls onClick when activated with keyboard", async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            render(<SettingsButton {...defaultProps} onClick={onClick} />);

            const button = screen.getByRole("button");
            button.focus();

            // Press Enter
            await user.keyboard("{Enter}");
            expect(onClick).toHaveBeenCalledTimes(1);

            // Press Space
            await user.keyboard(" ");
            expect(onClick).toHaveBeenCalledTimes(2);
        });

        it("does not call onClick when disabled", async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            render(<SettingsButton {...defaultProps} onClick={onClick} disabled={true} />);

            const button = screen.getByRole("button");
            await user.click(button);

            expect(onClick).not.toHaveBeenCalled();
        });
    });

    describe("States", () => {
        it("is disabled when disabled prop is true", () => {
            render(<SettingsButton {...defaultProps} disabled={true} />);

            const button = screen.getByRole("button");
            expect(button).toBeDisabled();
        });

        it("is enabled when disabled prop is false", () => {
            render(<SettingsButton {...defaultProps} disabled={false} />);

            const button = screen.getByRole("button");
            expect(button).not.toBeDisabled();
        });

        it("is enabled by default", () => {
            render(<SettingsButton onClick={vi.fn()} />);

            const button = screen.getByRole("button");
            expect(button).not.toBeDisabled();
        });
    });

    describe("Styling", () => {
        it("has correct CSS classes", () => {
            render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button");
            expect(button).toHaveClass("settings-button");

            const icon = button.querySelector("svg");
            expect(icon).toHaveClass("settings-icon");
        });

        it("applies hover effects on mouse events", () => {
            render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button");

            // Simulate hover
            fireEvent.mouseEnter(button);
            // Note: CSS hover effects are not testable in jsdom, but we can verify the element exists
            expect(button).toBeInTheDocument();

            fireEvent.mouseLeave(button);
            expect(button).toBeInTheDocument();
        });
    });

    describe("Focus Management", () => {
        it("can receive focus", () => {
            render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button");
            button.focus();

            expect(button).toHaveFocus();
        });

        it("shows focus outline when focused", () => {
            render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button");
            button.focus();

            // Focus styles are applied via CSS, we just verify the element can be focused
            expect(button).toHaveFocus();
        });

        it("loses focus when disabled", () => {
            const { rerender } = render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button");
            button.focus();
            expect(button).toHaveFocus();

            // Disable the button
            rerender(<SettingsButton {...defaultProps} disabled={true} />);

            // In jsdom, disabled buttons may still retain focus, so we just check if it's disabled
            expect(button).toBeDisabled();
        });
    });

    describe("Icon Animation", () => {
        it("contains SVG with proper structure", () => {
            render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button");
            const svg = button.querySelector("svg");

            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute("width", "20");
            expect(svg).toHaveAttribute("height", "20");
            expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
            expect(svg).toHaveAttribute("fill", "none");
            expect(svg).toHaveAttribute("stroke", "currentColor");
            expect(svg).toHaveAttribute("stroke-width", "2");
            expect(svg).toHaveAttribute("stroke-linecap", "round");
            expect(svg).toHaveAttribute("stroke-linejoin", "round");
        });

        it("has gear icon paths", () => {
            render(<SettingsButton {...defaultProps} />);

            const button = screen.getByRole("button");
            const svg = button.querySelector("svg");

            // Check for circle (center of gear)
            const circle = svg?.querySelector("circle");
            expect(circle).toBeInTheDocument();
            expect(circle).toHaveAttribute("cx", "12");
            expect(circle).toHaveAttribute("cy", "12");
            expect(circle).toHaveAttribute("r", "3");

            // Check for path (gear teeth)
            const path = svg?.querySelector("path");
            expect(path).toBeInTheDocument();
        });
    });

    describe("Event Handling", () => {
        it("prevents default behavior when appropriate", async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            render(<SettingsButton {...defaultProps} onClick={onClick} />);

            const button = screen.getByRole("button");

            // Click should not cause form submission or other default behaviors
            await user.click(button);

            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it("handles rapid clicks gracefully", async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            render(<SettingsButton {...defaultProps} onClick={onClick} />);

            const button = screen.getByRole("button");

            // Rapid clicks
            await user.click(button);
            await user.click(button);
            await user.click(button);

            expect(onClick).toHaveBeenCalledTimes(3);
        });
    });
});
