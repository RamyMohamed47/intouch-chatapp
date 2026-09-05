import { render, screen } from "@testing-library/react";
import type { VoiceChannelConversationDto } from "@intouch/shared/conversations";
import type { ConnectionQuality, ConnectionState } from "livekit-client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const localUserId = "507f1f77bcf86cd799439011";
  const remoteUserId = "507f1f77bcf86cd799439012";
  const localIdentity = "00000000-0000-4000-8000-000000000001";
  const remoteIdentity = "00000000-0000-4000-8000-000000000002";
  return {
    localIdentity,
    localUserId,
    remoteIdentity,
    remoteUserId,
    voice: {
      activeSession: {
        id: localIdentity,
        kind: "VOICE_CHANNEL" as const,
        organizationId: "507f1f77bcf86cd799439013",
        conversationId: "507f1f77bcf86cd799439014",
        callId: null,
        userId: localUserId,
        connectedAt: "2026-09-02T01:00:00.000Z",
      },
      activeSpeakerIdentities: [remoteIdentity],
      cameraTracks: [],
      connectionQuality: "excellent" as ConnectionQuality,
      connectionState: "connected" as ConnectionState,
      enablePlayback: vi.fn(),
      endSession: vi.fn(),
      error: null,
      isDeafened: false,
      isCameraEnabled: false,
      isCameraTransitioning: false,
      isMuted: false,
      isPlaybackBlocked: false,
      isTransitioning: false,
      joinChannel: vi.fn(),
      participantIdentities: [localIdentity, remoteIdentity],
      setInputDevice: vi.fn(),
      setVideoDevice: vi.fn(),
      toggleCamera: vi.fn(),
      toggleDeafen: vi.fn(),
      toggleMute: vi.fn(),
    },
  };
});

vi.mock("@/components/memberships/invite-member-dialog", () => ({
  InviteMemberDialog: () => null,
}));

vi.mock("@/components/users/user-avatar", () => ({
  UserAvatar: ({ displayName }: { displayName: string }) => (
    <span>{displayName} avatar</span>
  ),
}));

vi.mock("@/lib/query/hooks", () => ({
  useMembers: () => ({
    data: [
      {
        user: {
          id: mocks.localUserId,
          displayName: "Ramy Mohamed",
        },
      },
      {
        user: {
          id: mocks.remoteUserId,
          displayName: "Lina Hassan",
        },
      },
    ],
  }),
  useOrganization: () => ({
    data: { name: "InTouch", currentUserRole: "MEMBER" },
  }),
}));

vi.mock("@/lib/voice/provider", () => ({
  useVoice: () => mocks.voice,
}));

import { VoiceChannelPage } from "@/components/voice/voice-channel-page";

const conversation: VoiceChannelConversationDto = {
  id: "507f1f77bcf86cd799439014",
  organizationId: "507f1f77bcf86cd799439013",
  categoryId: "507f1f77bcf86cd799439015",
  name: "Daily standup",
  type: "CHANNEL",
  kind: "VOICE",
  visibility: "PUBLIC",
  position: 0,
  occupancy: {
    conversationId: "507f1f77bcf86cd799439014",
    capacity: 10,
    participantUserIds: [mocks.localUserId, mocks.remoteUserId],
    participants: [
      {
        userId: mocks.localUserId,
        participantIdentity: mocks.localIdentity,
      },
      {
        userId: mocks.remoteUserId,
        participantIdentity: mocks.remoteIdentity,
      },
    ],
  },
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("VoiceChannelPage", () => {
  it("uses a speaker icon for an active participant", () => {
    render(
      <VoiceChannelPage
        organizationId={conversation.organizationId}
        conversation={conversation}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Lina Hassan is speaking" }),
    ).toBeInTheDocument();
  });
});
