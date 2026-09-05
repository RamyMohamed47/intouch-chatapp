import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DirectConversationDto } from "@intouch/shared/conversations";
import type { ConnectionQuality, ConnectionState } from "livekit-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const initialMediaMode = (): "AUDIO" | "VIDEO" => "AUDIO";
  const localUserId = "507f1f77bcf86cd799439011";
  const peerUserId = "507f1f77bcf86cd799439012";
  const conversationId = "507f1f77bcf86cd799439013";
  const organizationId = "507f1f77bcf86cd799439014";
  const sessionId = "00000000-0000-4000-8000-000000000001";
  const remoteIdentity = "00000000-0000-4000-8000-000000000002";
  return {
    conversationId,
    enablePlayback: vi.fn(),
    endSession: vi.fn(),
    localUserId,
    organizationId,
    peerUserId,
    remoteIdentity,
    sessionId,
    setInputDevice: vi.fn(),
    setVideoDevice: vi.fn(),
    toggleCamera: vi.fn(),
    toggleDeafen: vi.fn(),
    toggleMute: vi.fn(),
    voice: {
      activeCall: {
        id: "507f1f77bcf86cd799439015",
        callerUserId: localUserId,
        mediaMode: initialMediaMode(),
        status: "ACTIVE" as const,
        answeredAt: "2026-09-02T01:00:00.000Z",
      },
      activeSession: {
        id: sessionId,
        kind: "CALL" as const,
        organizationId,
        conversationId,
        callId: "507f1f77bcf86cd799439015",
        userId: localUserId,
        connectedAt: "2026-09-02T01:00:00.000Z",
      },
      activeSpeakerIdentities: [remoteIdentity],
      cameraTracks: [],
      connectionQuality: "excellent" as ConnectionQuality,
      connectionState: "connected" as ConnectionState,
      error: null as string | null,
      isDeafened: false,
      isCameraEnabled: false,
      isCameraTransitioning: false,
      isMuted: false,
      isPlaybackBlocked: false,
      isTransitioning: false,
      participantIdentities: [sessionId, remoteIdentity],
    },
  };
});

const { conversationId, organizationId, peerUserId, remoteIdentity } = mocks;

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    user: {
      id: mocks.localUserId,
      username: "ramy",
      displayName: "Ramy Mohamed",
      avatarAssetId: null,
    },
  }),
}));

vi.mock("@/lib/query/hooks", () => ({
  useMembers: () => ({
    data: [
      {
        membershipId: "507f1f77bcf86cd799439016",
        role: "MEMBER",
        joinedAt: "2026-09-01T00:00:00.000Z",
        user: {
          id: mocks.peerUserId,
          username: "lina",
          displayName: "Lina Hassan",
          avatarAssetId: null,
          status: "ONLINE",
          lastSeenAt: null,
        },
      },
    ],
  }),
}));

vi.mock("@/components/users/user-avatar", () => ({
  UserAvatar: ({ displayName }: { displayName: string }) => (
    <span>{displayName} avatar</span>
  ),
}));

vi.mock("@/lib/voice/provider", () => ({
  useVoice: () => ({
    ...mocks.voice,
    enablePlayback: mocks.enablePlayback,
    endSession: mocks.endSession,
    setInputDevice: mocks.setInputDevice,
    setVideoDevice: mocks.setVideoDevice,
    toggleCamera: mocks.toggleCamera,
    toggleDeafen: mocks.toggleDeafen,
    toggleMute: mocks.toggleMute,
  }),
}));

import { DirectCallPage } from "@/components/voice/direct-call-page";

const conversation: DirectConversationDto = {
  id: conversationId,
  organizationId,
  type: "DIRECT",
  peer: {
    id: peerUserId,
    username: "lina",
    displayName: "Lina Hassan",
    avatarAssetId: null,
  },
  lastMessage: null,
  unreadCount: 0,
  readReceipt: null,
  peerReadReceipt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("DirectCallPage", () => {
  beforeEach(() => {
    mocks.enablePlayback.mockReset();
    mocks.endSession.mockReset();
    mocks.toggleDeafen.mockReset();
    mocks.toggleCamera.mockReset();
    mocks.toggleMute.mockReset();
    mocks.voice.activeSpeakerIdentities = [remoteIdentity];
    mocks.voice.activeCall.mediaMode = "AUDIO";
    mocks.voice.isPlaybackBlocked = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a dedicated call surface with participant state", () => {
    render(
      <DirectCallPage conversation={conversation} organizationName="InTouch" />,
    );

    expect(
      screen.getByRole("heading", { name: "Lina Hassan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Call connected")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Lina Hassan is speaking" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Lina Hassan is online" }),
    ).toBeInTheDocument();
  });

  it("uses the same mute, deafen, playback, and end-call controls", async () => {
    mocks.voice.isPlaybackBlocked = true;
    render(
      <DirectCallPage conversation={conversation} organizationName="InTouch" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Enable audio" }));
    await userEvent.click(screen.getByRole("button", { name: "Mute" }));
    await userEvent.click(screen.getByRole("button", { name: "Deafen" }));
    await userEvent.click(screen.getByRole("button", { name: "Camera" }));
    await userEvent.click(screen.getByRole("button", { name: "End call" }));

    expect(mocks.enablePlayback).toHaveBeenCalledOnce();
    expect(mocks.toggleMute).toHaveBeenCalledOnce();
    expect(mocks.toggleDeafen).toHaveBeenCalledOnce();
    expect(mocks.toggleCamera).toHaveBeenCalledOnce();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it("labels calls that started in video mode", () => {
    mocks.voice.activeCall.mediaMode = "VIDEO";

    render(
      <DirectCallPage conversation={conversation} organizationName="InTouch" />,
    );

    expect(screen.getByText("Live video call")).toBeInTheDocument();
  });

  it("shows a live duration anchored to the shared answered time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T01:01:05.000Z"));

    render(
      <DirectCallPage conversation={conversation} organizationName="InTouch" />,
    );

    expect(screen.getByText("01:05")).toHaveAccessibleName(
      "Call duration 1 minute, 5 seconds",
    );

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText("01:06")).toHaveAccessibleName(
      "Call duration 1 minute, 6 seconds",
    );
  });
});
