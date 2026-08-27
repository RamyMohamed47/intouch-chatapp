import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  formatTypingMessage,
  TypingIndicator,
} from "@/components/conversations/typing-indicator";

describe("TypingIndicator", () => {
  it("formats singular, dual, and summarized typing activity", () => {
    expect(formatTypingMessage(["Alex"])).toBe("Alex is typing");
    expect(formatTypingMessage(["Alex", "Lina"])).toBe(
      "Alex and Lina are typing",
    );
    expect(formatTypingMessage(["Alex", "Lina", "Noor", "Ramy"])).toBe(
      "Alex, Lina, and 2 others are typing",
    );
  });

  it("uses safe fallbacks when member names are unavailable", () => {
    expect(formatTypingMessage([undefined])).toBe("Someone is typing");
    expect(formatTypingMessage(["Alex", undefined])).toBe(
      "Alex and someone else are typing",
    );
    expect(formatTypingMessage([undefined, undefined, undefined])).toBe(
      "3 people are typing",
    );
  });

  it("reserves space and exposes one atomic polite live region", () => {
    const { container, rerender } = render(<TypingIndicator names={[]} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveClass("h-6");

    rerender(<TypingIndicator names={["Alex"]} />);
    expect(screen.getByText("Alex is typing")).toBeInTheDocument();
    expect(container.querySelectorAll(".typing-indicator-dot")).toHaveLength(3);
    expect(container.querySelector(".typing-indicator-dots")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
