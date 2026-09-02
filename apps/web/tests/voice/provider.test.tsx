import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CallDto, VoiceSessionDto } from "@intouch/shared/voice";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  activeSession: vi.fn(),
  dismissIncomingCall: vi.fn(),
  heartbeatVoice: vi.fn(),
  joinChannel: vi.fn(),
  leave: vi.fn(),
  resume: vi.fn(),
  startCall: vi.fn(),
  transition: vi.fn(),
  realtime: {
    incomingCall: null as CallDto | null,
    latestCall: null as CallDto | null,
  },
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "507f1f77bcf86cd799439011" },
  }),
}));

vi.mock("@/lib/api/voice", () => ({
  voiceApi: {
    accept: mocks.accept,
    activeSession: mocks.activeSession,
    joinChannel: mocks.joinChannel,
    leave: mocks.leave,
    resume: mocks.resume,
    startCall: mocks.startCall,
    transition: mocks.transition,
  },
}));

vi.mock("@/lib/realtime/provider", () => ({
  useRealtime: () => ({
    ...mocks.realtime,
    dismissIncomingCall: mocks.dismissIncomingCall,
    heartbeatVoice: mocks.heartbeatVoice,
  }),
}));

import { VoiceProvider, useVoice } from "@/lib/voice/provider";
import { queryKeys } from "@/lib/query/keys";

const conversationId = "507f1f77bcf86cd799439012";
const organizationId = "507f1f77bcf86cd799439013";
const callerUserId = "507f1f77bcf86cd799439011";
const recipientUserId = "507f1f77bcf86cd799439014";

const session: VoiceSessionDto = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "VOICE_CHANNEL",
  organizationId,
  conversationId,
  callId: null,
  userId: callerUserId,
  connectedAt: null,
};

const credentials = {
  serverUrl: "wss://voice.example.com",
  token: "test-token",
  expiresAt: "2026-09-01T01:00:00.000Z",
};

const incomingCall: CallDto = {
  id: "507f1f77bcf86cd799439015",
  organizationId,
  conversationId,
  callerUserId,
  recipientUserId,
  status: "RINGING",
  endReason: null,
  startedAt: "2026-09-01T00:00:00.000Z",
  answeredAt: null,
  endedAt: null,
  durationSeconds: null,
};

const callSession: VoiceSessionDto = {
  ...session,
  id: "00000000-0000-4000-8000-000000000002",
  kind: "CALL",
  callId: incomingCall.id,
};

class FakeRoom {
  canPlaybackAudio = true;
  readonly connect = vi.fn(() => {
    this.listeners.get(RoomEvent.ConnectionStateChanged)?.(
      ConnectionState.Connected,
    );
    return Promise.resolve();
  });
  readonly disconnect = vi.fn();
  readonly startAudio = vi.fn(() => {
    this.canPlaybackAudio = true;
    this.emit(RoomEvent.AudioPlaybackStatusChanged, true);
    return Promise.resolve();
  });
  readonly localParticipant = {
    identity: session.id,
    setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
  };
  readonly remoteParticipants = new Map();
  readonly switchActiveDevice = vi.fn().mockResolvedValue(true);
  private readonly listeners = new Map<
    RoomEvent,
    (...args: unknown[]) => void
  >();

  on(event: RoomEvent, listener: (...args: never[]) => void) {
    this.listeners.set(event, listener as (...args: unknown[]) => void);
    return this;
  }

  emit(event: RoomEvent, ...args: unknown[]) {
    this.listeners.get(event)?.(...args);
  }
}

function Probe() {
  const voice = useVoice();
  return (
    <div>
      <span>{voice.activeSession?.id ?? "no-session"}</span>
      <span>{voice.error ?? "no-voice-error"}</span>
      <span>{voice.isTransitioning ? "voice-pending" : "voice-idle"}</span>
      <span>
        {voice.isPlaybackBlocked ? "playback-blocked" : "playback-ready"}
      </span>
      <button
        type="button"
        onClick={() => void voice.joinChannel(conversationId)}
      >
        Join test channel
      </button>
      <button type="button" onClick={() => void voice.endSession()}>
        Leave test channel
      </button>
      <button
        type="button"
        onClick={() => void voice.startCall(conversationId)}
      >
        Start test call
      </button>
      <button type="button" onClick={() => void voice.enablePlayback()}>
        Enable test audio
      </button>
    </div>
  );
}

const renderProvider = (
  room: FakeRoom,
  seedQueryClient?: (queryClient: QueryClient) => void,
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  seedQueryClient?.(queryClient);
  return render(
    <QueryClientProvider client={queryClient}>
      <VoiceProvider roomFactory={() => room as unknown as Room}>
        <Probe />
      </VoiceProvider>
    </QueryClientProvider>,
  );
};

describe("VoiceProvider", () => {
  beforeEach(() => {
    mocks.accept.mockReset();
    mocks.activeSession.mockResolvedValue(null);
    mocks.dismissIncomingCall.mockReset();
    mocks.heartbeatVoice.mockResolvedValue({ success: true });
    mocks.joinChannel.mockReset();
    mocks.leave.mockResolvedValue(undefined);
    mocks.resume.mockReset();
    mocks.startCall.mockReset();
    mocks.transition.mockReset();
    mocks.realtime.incomingCall = null;
    mocks.realtime.latestCall = null;
  });

  it("joins and leaves a channel through one persistent media room", async () => {
    const room = new FakeRoom();
    mocks.joinChannel.mockResolvedValue({ session, credentials });
    renderProvider(room);

    await userEvent.click(
      screen.getByRole("button", { name: "Join test channel" }),
    );

    expect(await screen.findByText(session.id)).toBeInTheDocument();
    expect(room.connect).toHaveBeenCalledWith(
      credentials.serverUrl,
      credentials.token,
    );
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
      true,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Leave test channel" }),
    );
    await waitFor(() => expect(mocks.leave).toHaveBeenCalledOnce());
    expect(room.disconnect).toHaveBeenCalled();
    expect(screen.getByText("no-session")).toBeInTheDocument();
  });

  it("attaches subscribed remote audio and detaches it when unsubscribed", async () => {
    const room = new FakeRoom();
    const audio = document.createElement("audio");
    const track = {
      kind: Track.Kind.Audio,
      attach: vi.fn(() => audio),
      detach: vi.fn(() => [audio]),
    };
    mocks.joinChannel.mockResolvedValue({ session, credentials });
    renderProvider(room);

    await userEvent.click(
      screen.getByRole("button", { name: "Join test channel" }),
    );
    await screen.findByText(session.id);

    act(() => room.emit(RoomEvent.TrackSubscribed, track));
    expect(track.attach).toHaveBeenCalledOnce();
    expect(audio.autoplay).toBe(true);
    expect(audio).toHaveAttribute("aria-hidden", "true");
    expect(document.body).toContainElement(audio);

    act(() => room.emit(RoomEvent.TrackUnsubscribed, track));
    expect(track.detach).toHaveBeenCalledOnce();
    expect(document.body).not.toContainElement(audio);
  });

  it("offers a user-gesture recovery when the browser blocks audio", async () => {
    const room = new FakeRoom();
    mocks.joinChannel.mockResolvedValue({ session, credentials });
    renderProvider(room);

    await userEvent.click(
      screen.getByRole("button", { name: "Join test channel" }),
    );
    await screen.findByText(session.id);

    room.canPlaybackAudio = false;
    act(() => room.emit(RoomEvent.AudioPlaybackStatusChanged, false));
    expect(screen.getByText("playback-blocked")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Enable test audio" }),
    );
    await waitFor(() => expect(room.startAudio).toHaveBeenCalledOnce());
    expect(screen.getByText("playback-ready")).toBeInTheDocument();
  });

  it("detaches subscribed audio when the provider unmounts", async () => {
    const room = new FakeRoom();
    const audio = document.createElement("audio");
    const track = {
      kind: Track.Kind.Audio,
      attach: vi.fn(() => audio),
      detach: vi.fn(() => [audio]),
    };
    mocks.joinChannel.mockResolvedValue({ session, credentials });
    const view = renderProvider(room);

    await userEvent.click(
      screen.getByRole("button", { name: "Join test channel" }),
    );
    await screen.findByText(session.id);
    act(() => room.emit(RoomEvent.TrackSubscribed, track));

    view.unmount();
    expect(track.detach).toHaveBeenCalledOnce();
    expect(document.body).not.toContainElement(audio);
  });

  it("serializes duplicate join attempts while the first is pending", async () => {
    const room = new FakeRoom();
    let resolveJoin:
      | ((result: {
          session: VoiceSessionDto;
          credentials: typeof credentials;
        }) => void)
      | undefined;
    mocks.joinChannel.mockReturnValue(
      new Promise((resolve) => {
        resolveJoin = resolve;
      }),
    );
    renderProvider(room);
    const join = screen.getByRole("button", { name: "Join test channel" });

    await userEvent.click(join);
    await userEvent.click(join);

    expect(mocks.joinChannel).toHaveBeenCalledOnce();
    expect(screen.getByText("voice-pending")).toBeInTheDocument();

    resolveJoin?.({ session, credentials });
    expect(await screen.findByText(session.id)).toBeInTheDocument();
    expect(screen.getByText("voice-idle")).toBeInTheDocument();
  });

  it("renders an expected join failure without rejecting the event handler", async () => {
    const room = new FakeRoom();
    mocks.joinChannel.mockRejectedValue(
      new Error("Leave your current voice session before joining another"),
    );
    renderProvider(room);

    await userEvent.click(
      screen.getByRole("button", { name: "Join test channel" }),
    );

    expect(
      await screen.findByText(
        "Leave your current voice session before joining another",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("voice-idle")).toBeInTheDocument();
    expect(screen.getByText("no-session")).toBeInTheDocument();
  });

  it("restores an authorized active session after reload", async () => {
    const room = new FakeRoom();
    mocks.activeSession.mockResolvedValue(session);
    mocks.resume.mockResolvedValue({ session, credentials });
    renderProvider(room);

    expect(await screen.findByText(session.id)).toBeInTheDocument();
    expect(mocks.resume).toHaveBeenCalledOnce();
    expect(room.connect).toHaveBeenCalledOnce();
  });

  it("cancels an outgoing ringing call instead of generically ending it", async () => {
    const room = new FakeRoom();
    mocks.activeSession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(callSession);
    mocks.startCall.mockResolvedValue({ call: incomingCall, credentials });
    renderProvider(room);
    await waitFor(() => expect(mocks.activeSession).toHaveBeenCalledOnce());

    await userEvent.click(
      screen.getByRole("button", { name: "Start test call" }),
    );
    await waitFor(() => expect(room.connect).toHaveBeenCalledOnce());
    await userEvent.click(
      screen.getByRole("button", { name: "Leave test channel" }),
    );

    expect(mocks.transition).toHaveBeenCalledWith(incomingCall.id, "cancel");
  });

  it("renders and declines an incoming call", async () => {
    const room = new FakeRoom();
    mocks.realtime.incomingCall = incomingCall;
    mocks.transition.mockResolvedValue({
      ...incomingCall,
      status: "ENDED",
      endReason: "DECLINED",
      endedAt: "2026-09-01T00:00:02.000Z",
    });
    renderProvider(room);

    expect(
      await screen.findByRole("heading", { name: "Incoming voice call" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(mocks.transition).toHaveBeenCalledWith(incomingCall.id, "decline");
    expect(mocks.dismissIncomingCall).toHaveBeenCalled();
  });

  it("resolves incoming caller names only from member-roster caches", async () => {
    const room = new FakeRoom();
    mocks.realtime.incomingCall = incomingCall;
    renderProvider(room, (queryClient) => {
      queryClient.setQueryData(
        queryKeys.conversations.channels(organizationId),
        [{ id: conversationId }],
      );
      queryClient.setQueryData(queryKeys.members.list(organizationId), [
        {
          membershipId: "507f1f77bcf86cd799439016",
          role: "MEMBER",
          joinedAt: "2026-09-01T00:00:00.000Z",
          user: {
            id: callerUserId,
            username: "caller",
            displayName: "Caller Name",
            avatarAssetId: null,
            status: "ONLINE",
            lastSeenAt: null,
          },
        },
      ]);
    });

    expect(
      await screen.findByText("Caller Name is calling you."),
    ).toBeInTheDocument();
  });
});
