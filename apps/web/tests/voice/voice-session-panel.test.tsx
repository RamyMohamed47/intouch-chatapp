import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConnectionQuality, ConnectionState } from "livekit-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const organizationId = "507f1f77bcf86cd799439013";
  const conversationId = "507f1f77bcf86cd799439012";
  return {
    conversationId,
    enablePlayback: vi.fn(),
    endSession: vi.fn(),
    organizationId,
    pathname: "/app",
    toggleDeafen: vi.fn(),
    toggleMute: vi.fn(),
    voice: {
      activeSession: {
        id: "00000000-0000-4000-8000-000000000001",
        kind: "VOICE_CHANNEL" as "VOICE_CHANNEL" | "CALL",
        organizationId,
        conversationId,
        callId: null,
        userId: "507f1f77bcf86cd799439011",
        connectedAt: null,
      },
      connectionQuality: "excellent" as ConnectionQuality,
      connectionState: "connected" as ConnectionState,
      isDeafened: false,
      isMuted: false,
      isPlaybackBlocked: false,
      isTransitioning: false,
      error: null as string | null,
      participantIdentities: ["local-participant"],
    },
  };
});

const { conversationId, organizationId } = mocks;

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/lib/query/hooks", () => ({
  useConversation: () => ({
    data: {
      id: conversationId,
      organizationId,
      type: "CHANNEL",
      kind: "VOICE",
      name: "Daily standup",
    },
  }),
}));

vi.mock("@/lib/voice/provider", () => ({
  useVoice: () => ({
    ...mocks.voice,
    enablePlayback: mocks.enablePlayback,
    endSession: mocks.endSession,
    toggleDeafen: mocks.toggleDeafen,
    toggleMute: mocks.toggleMute,
  }),
}));

import { VoiceSessionPanel } from "@/components/voice/voice-session-panel";

describe("VoiceSessionPanel", () => {
  beforeEach(() => {
    mocks.pathname = "/app";
    mocks.endSession.mockReset();
    mocks.enablePlayback.mockReset();
    mocks.voice.error = null;
    mocks.voice.isTransitioning = false;
    mocks.voice.isPlaybackBlocked = false;
    mocks.voice.activeSession.kind = "VOICE_CHANNEL";
    mocks.toggleDeafen.mockReset();
    mocks.toggleMute.mockReset();
  });

  it("renders the active channel and controls in the workspace sidebar", async () => {
    render(<VoiceSessionPanel variant="sidebar" />);

    expect(
      screen.getByRole("complementary", {
        name: "Active voice session controls",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Daily standup/ })).toHaveAttribute(
      "href",
      `/app/${organizationId}/channels/${conversationId}`,
    );
    expect(screen.getByText("1 connected · excellent")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Mute microphone" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Deafen" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Leave voice session" }),
    );

    expect(mocks.toggleMute).toHaveBeenCalledOnce();
    expect(mocks.toggleDeafen).toHaveBeenCalledOnce();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it("hides the persistent panel on its active voice-channel page", () => {
    mocks.pathname = `/app/${organizationId}/channels/${conversationId}`;
    render(<VoiceSessionPanel variant="sidebar" />);

    expect(
      screen.queryByRole("complementary", {
        name: "Active voice session controls",
      }),
    ).not.toBeInTheDocument();
  });

  it("hides the persistent panel on its active direct-call page", () => {
    mocks.voice.activeSession.kind = "CALL";
    mocks.pathname = `/app/${organizationId}/direct-messages/${conversationId}`;
    render(<VoiceSessionPanel variant="sidebar" />);

    expect(
      screen.queryByRole("complementary", {
        name: "Active voice session controls",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders the compact mobile tray in document flow", () => {
    render(<VoiceSessionPanel variant="mobile" />);

    expect(
      screen.getByRole("complementary", {
        name: "Active voice session controls",
      }),
    ).toHaveClass("shrink-0", "md:hidden");
  });

  it("offers playback recovery when the browser blocks remote audio", async () => {
    mocks.voice.isPlaybackBlocked = true;
    render(<VoiceSessionPanel variant="sidebar" />);

    await userEvent.click(screen.getByRole("button", { name: "Enable audio" }));

    expect(mocks.enablePlayback).toHaveBeenCalledOnce();
  });
});
