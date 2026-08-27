import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPresencePresentation,
  PresenceIndicator,
} from "@/components/presence/presence-indicator";

const now = Date.parse("2026-08-27T12:00:00.000Z");

describe("PresenceIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats online, missing, and relative offline states", () => {
    expect(
      getPresencePresentation({
        displayName: "Alex",
        status: "ONLINE",
        lastSeenAt: "2026-08-20T12:00:00.000Z",
        now,
      }),
    ).toEqual({ accessibleLabel: "Alex is online", label: "Online" });
    expect(
      getPresencePresentation({
        displayName: "Alex",
        status: "OFFLINE",
        lastSeenAt: null,
        now,
      }),
    ).toEqual({ accessibleLabel: "Alex is offline", label: "Offline" });
    expect(
      getPresencePresentation({
        displayName: "Alex",
        status: "OFFLINE",
        lastSeenAt: "2026-08-27T11:52:00.000Z",
        locale: "en",
        now,
      }),
    ).toEqual({
      accessibleLabel: "Alex was last seen 8 minutes ago",
      label: "Last seen 8 minutes ago",
    });
  });

  it("renders an accessible label and refreshes relative time each minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    render(
      <PresenceIndicator
        displayName="Alex"
        status="OFFLINE"
        lastSeenAt="2026-08-27T11:52:00.000Z"
      />,
    );

    expect(
      screen.getByRole("status", { name: "Alex was last seen 8 minutes ago" }),
    ).toHaveTextContent("Last seen 8 minutes ago");
    await act(() => vi.advanceTimersByTime(60_000));
    expect(
      screen.getByRole("status", { name: "Alex was last seen 9 minutes ago" }),
    ).toHaveTextContent("Last seen 9 minutes ago");
  });

  it("provides an accessible compact dot and tooltip", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <PresenceIndicator
          displayName="Lina"
          status="ONLINE"
          lastSeenAt={null}
          variant="compact"
        />
      </div>,
    );

    const indicator = screen.getByRole("status", { name: "Lina is online" });
    await user.hover(indicator);
    expect(await screen.findByText("Online")).toBeInTheDocument();
  });
});
