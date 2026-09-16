import { act, render, screen } from "@testing-library/react-native";
import { EventEmitter } from "events";

import { VoiceStage } from "@/features/voice/voice-ui";

interface FakeParticipant {
  identity: string;
  isSpeaking: boolean;
}

interface FakeTrackReference {
  participant: FakeParticipant;
  publication: { isMuted: boolean };
  source: "camera" | "screen_share";
}

interface ParticipantLabel {
  displayName: string;
  userId: string;
}

class FakeRoom extends EventEmitter {
  readonly localParticipant: FakeParticipant;
  readonly remoteParticipants = new Map<string, FakeParticipant>();

  constructor(localIdentity: string) {
    super();
    this.localParticipant = { identity: localIdentity, isSpeaking: false };
  }

  participants() {
    return [this.localParticipant, ...this.remoteParticipants.values()];
  }

  addParticipant(identity: string) {
    const participant: FakeParticipant = { identity, isSpeaking: false };
    this.remoteParticipants.set(identity, participant);
    return participant;
  }

  connectParticipant(identity: string) {
    const participant = this.addParticipant(identity);
    this.emit("participantConnected", participant);
    return participant;
  }

  disconnectParticipant(identity: string) {
    const participant = this.remoteParticipants.get(identity);
    this.remoteParticipants.delete(identity);
    this.emit("participantDisconnected", participant);
  }
}

const mockTracks = jest.fn<FakeTrackReference[], []>(() => []);
const mockVoice = jest.fn<unknown, []>();

jest.mock("@livekit/react-native", () => {
  const react = jest.requireActual<typeof import("react")>("react");
  const reactNative =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    // Stands in for the real hook's contract: the list comes from the room and
    // is refreshed by participant room events, never from a manual counter.
    useParticipants: (options: {
      room: {
        off: (event: string, listener: () => void) => void;
        on: (event: string, listener: () => void) => void;
        participants: () => unknown[];
      };
    }) => {
      const room = options.room;
      const [participants, setParticipants] = react.useState(() =>
        room.participants(),
      );
      react.useEffect(() => {
        const update = () => setParticipants(room.participants());
        room.on("participantConnected", update);
        room.on("participantDisconnected", update);
        return () => {
          room.off("participantConnected", update);
          room.off("participantDisconnected", update);
        };
      }, [room]);
      return participants;
    },
    useTracks: () => mockTracks(),
    VideoTrack: (props: {
      trackRef: { participant: { identity: string }; source: string };
    }) =>
      react.createElement(reactNative.View, {
        testID: `video-${props.trackRef.source}-${props.trackRef.participant.identity}`,
      }),
  };
});

jest.mock("livekit-client", () => ({
  Track: { Source: { Camera: "camera", ScreenShare: "screen_share" } },
}));

jest.mock("expo-router", () => ({ usePathname: () => "/chats" }));

jest.mock("lucide-react-native", () => {
  const icon = () => null;
  return {
    Camera: icon,
    CameraOff: icon,
    Check: icon,
    Headphones: icon,
    HeadphoneOff: icon,
    Maximize2: icon,
    Mic: icon,
    MicOff: icon,
    MonitorUp: icon,
    Phone: icon,
    PhoneOff: icon,
    Square: icon,
    Volume2: icon,
    X: icon,
  };
});

jest.mock("@/components/user-avatar", () => ({ UserAvatar: () => null }));

jest.mock("@/features/appearance/appearance-provider", () => ({
  useAppearance: () => ({
    theme: {
      accent: "#2f9dff",
      accentSoft: "#0c2d52",
      background: "#050b16",
      border: "#1b2b44",
      danger: "#ff5c72",
      muted: "#93a4bf",
      panel: "#0a1425",
      panelStrong: "#101d31",
      success: "#3ed598",
      text: "#edf5ff",
    },
  }),
}));

jest.mock("@/features/voice/voice-provider", () => ({
  useVoice: () => mockVoice(),
}));

const LOCAL_IDENTITY = "session-local";
const REMOTE_IDENTITY = "session-remote";

const localLabel: ParticipantLabel = {
  userId: "user-local",
  displayName: "You",
};
const remoteLabel: ParticipantLabel = {
  userId: "user-remote",
  displayName: "Mina",
};

const labels = (entries: [string, ParticipantLabel][]) =>
  new Map<string, ParticipantLabel>(entries);

const stage = (participantLabels: Map<string, ParticipantLabel>) => (
  <VoiceStage participantLabels={participantLabels} title="Voice lounge" />
);

const renderStage = (
  room: FakeRoom,
  participantLabels: Map<string, ParticipantLabel>,
) => {
  mockVoice.mockReturnValue({
    activeSession: { conversationId: "conversation-1", kind: "VOICE_CHANNEL" },
    audioOutputs: [],
    cameraEnabled: false,
    connectionState: "connected",
    deafened: false,
    error: null,
    muted: false,
    room,
    screenShareEnabled: false,
    selectedAudioOutput: null,
    disconnectParticipant: jest.fn(),
    endCall: jest.fn(),
    leave: jest.fn(),
    muteParticipant: jest.fn(),
    selectAudioOutput: jest.fn(),
    stopParticipantScreenShare: jest.fn(),
    toggleCamera: jest.fn(),
    toggleDeafen: jest.fn(),
    toggleMicrophone: jest.fn(),
    toggleScreenShare: jest.fn(),
  });
  return render(stage(participantLabels));
};

describe("VoiceStage participant rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTracks.mockReturnValue([]);
  });

  test("renders the local participant when nobody else has joined", () => {
    renderStage(
      new FakeRoom(LOCAL_IDENTITY),
      labels([[LOCAL_IDENTITY, localLabel]]),
    );

    expect(screen.getByText("1 connected")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
  });

  test("renders a participant already present in the initial room state", () => {
    const room = new FakeRoom(LOCAL_IDENTITY);
    room.addParticipant(REMOTE_IDENTITY);

    renderStage(
      room,
      labels([
        [LOCAL_IDENTITY, localLabel],
        [REMOTE_IDENTITY, remoteLabel],
      ]),
    );

    expect(screen.getByText("2 connected")).toBeTruthy();
    expect(screen.getByText("Mina")).toBeTruthy();
  });

  test("renders a card when a remote participant connects after the join", () => {
    const room = new FakeRoom(LOCAL_IDENTITY);
    renderStage(room, labels([[LOCAL_IDENTITY, localLabel]]));

    expect(screen.getByText("1 connected")).toBeTruthy();

    act(() => {
      room.connectParticipant(REMOTE_IDENTITY);
    });

    expect(screen.getByText("2 connected")).toBeTruthy();
    expect(screen.getByText("Teammate")).toBeTruthy();
  });

  test("removes the card when the remote participant disconnects", () => {
    const room = new FakeRoom(LOCAL_IDENTITY);
    room.addParticipant(REMOTE_IDENTITY);
    renderStage(room, labels([[LOCAL_IDENTITY, localLabel]]));

    expect(screen.getByText("2 connected")).toBeTruthy();

    act(() => {
      room.disconnectParticipant(REMOTE_IDENTITY);
    });

    expect(screen.getByText("1 connected")).toBeTruthy();
    expect(screen.queryByText("Teammate")).toBeNull();
  });

  test("renders an identity reported by both the provider and occupancy once", () => {
    const room = new FakeRoom(LOCAL_IDENTITY);
    room.addParticipant(REMOTE_IDENTITY);

    renderStage(
      room,
      labels([
        [LOCAL_IDENTITY, localLabel],
        [REMOTE_IDENTITY, remoteLabel],
      ]),
    );

    expect(screen.getByText("2 connected")).toBeTruthy();
    expect(screen.getAllByText("Mina")).toHaveLength(1);
  });

  test("renders an occupancy participant the provider has not reported", () => {
    renderStage(
      new FakeRoom(LOCAL_IDENTITY),
      labels([
        [LOCAL_IDENTITY, localLabel],
        [REMOTE_IDENTITY, remoteLabel],
      ]),
    );

    expect(screen.getByText("2 connected")).toBeTruthy();
    expect(screen.getByText("Mina")).toBeTruthy();
  });

  test("hydrates names from occupancy without needing it to discover anyone", () => {
    const room = new FakeRoom(LOCAL_IDENTITY);
    const view = renderStage(room, labels([[LOCAL_IDENTITY, localLabel]]));

    act(() => {
      room.connectParticipant(REMOTE_IDENTITY);
    });
    expect(screen.getByText("Teammate")).toBeTruthy();

    view.rerender(
      stage(
        labels([
          [LOCAL_IDENTITY, localLabel],
          [REMOTE_IDENTITY, remoteLabel],
        ]),
      ),
    );

    expect(screen.getByText("Mina")).toBeTruthy();
    expect(screen.queryByText("Teammate")).toBeNull();
  });

  test("maps camera and screen-share publications to their own participant", () => {
    const room = new FakeRoom(LOCAL_IDENTITY);
    const remote = room.addParticipant(REMOTE_IDENTITY);
    mockTracks.mockReturnValue([
      {
        participant: remote,
        publication: { isMuted: false },
        source: "camera",
      },
      {
        participant: room.localParticipant,
        publication: { isMuted: false },
        source: "screen_share",
      },
    ]);

    renderStage(
      room,
      labels([
        [LOCAL_IDENTITY, localLabel],
        [REMOTE_IDENTITY, remoteLabel],
      ]),
    );

    expect(screen.getByTestId(`video-camera-${REMOTE_IDENTITY}`)).toBeTruthy();
    expect(
      screen.getByTestId(`video-screen_share-${LOCAL_IDENTITY}`),
    ).toBeTruthy();
    expect(screen.queryByTestId(`video-camera-${LOCAL_IDENTITY}`)).toBeNull();
  });

  test("never renders provider identities as visible text", () => {
    const room = new FakeRoom(LOCAL_IDENTITY);
    room.addParticipant(REMOTE_IDENTITY);

    renderStage(
      room,
      labels([
        [LOCAL_IDENTITY, localLabel],
        [REMOTE_IDENTITY, remoteLabel],
      ]),
    );

    expect(screen.queryByText(LOCAL_IDENTITY)).toBeNull();
    expect(screen.queryByText(REMOTE_IDENTITY)).toBeNull();
  });
});
