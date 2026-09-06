import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LocalVideoTrack } from "livekit-client";
import { describe, expect, it, vi } from "vitest";

import {
  ScreenShareStage,
  type ScreenSharePresenter,
} from "@/components/voice/screen-share-stage";

const share = (
  id: string,
  displayName: string,
  observedOrder: number,
): ScreenSharePresenter => ({
  displayName,
  hasAudio: id === "lina",
  id,
  identity: `${id}-identity`,
  isLocal: id === "ramy",
  observedOrder,
  source: "screen_share",
  track: {
    attach: vi.fn(),
    detach: vi.fn(),
  } as unknown as LocalVideoTrack,
});

describe("ScreenShareStage", () => {
  it("focuses the newest share and supports manual selection", async () => {
    const ramy = share("ramy", "Ramy", 1);
    const lina = share("lina", "Lina", 2);
    const view = render(<ScreenShareStage shares={[ramy, lina]} />);

    expect(
      screen.getByRole("button", { name: "View Lina's shared screen" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Shared audio")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "View Ramy's shared screen" }),
    );
    expect(
      screen.getByRole("button", { name: "View Ramy's shared screen" }),
    ).toHaveAttribute("aria-pressed", "true");

    const alex = share("alex", "Alex", 3);
    view.rerender(<ScreenShareStage shares={[ramy, lina, alex]} />);
    expect(
      screen.getByRole("button", { name: "View Alex's shared screen" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("announces the selected presenter through a polite status", () => {
    render(<ScreenShareStage shares={[share("ramy", "Ramy", 1)]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ramy is sharing a screen",
    );
    expect(screen.getByLabelText("Ramy's screen")).toHaveClass(
      "object-contain",
    );
  });
});
