import { render, screen } from "@testing-library/react-native";

import { VoiceStage } from "@/features/voice/voice-ui";

interface FakeParticipant {
  identity: string;
  isSpeaking: boolean;
}

const mockParticipants = jest.fn<FakeParticipant[], [unknown]>();
const mockTracks = jest.fn<never[], []>(() => []);
const mockVoice = jest.fn<Record<string, unknown>, []>();

jest.mock("@livekit/react-native", () => ({
  useParticipants: (options: unknown): FakeParticipant[] =>
    mockParticipants(options),
  useTracks: () => mockTracks(),
  VideoTrack: () => null,
}));

jest.mock("livekit-client", () => ({
  Track: { Source: { Camera: "camera", ScreenShare: "screen_share" } },
}));

jest.mock("expo-router", () => ({ usePathname: () => "/chats" }));

jest.mock("lucide-react-native", () => {
  const Icon = () => null;
  return {
    Camera: Icon,
    CameraOff: Icon,
    Check: Icon,
    Headphones: Icon,
    HeadphoneOff: Icon,
    Maximize2: Icon,
    Mic: Icon,
    MicOff: Icon,
    MonitorUp: Icon,
    Phone: Icon,
    PhoneOff: Icon,
    Square: Icon,
    Volume2: Icon,
    X: Icon,
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
  useVoice: (): Record<string, unknown> => mockVoice(),
}));

const localParticipant = { identity: "session-local", isSpeaking: false };
const remoteParticipant = { identity: "session-remote", isSpeaking: false };
const room = {
  localParticipant,
  remoteParticipants: new Map(),
};

describe("VoiceStage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParticipants.mockReturnValue([localParticipant, remoteParticipant]);
    mockVoice.mockReturnValue({
      activeSession: { kind: "VOICE_CHANNEL" },
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
  });

  test("renders participants from LiveKit's reactive participant hook", async () => {
    await render(
      <VoiceStage
        participantLabels={
          new Map([
            [
              localParticipant.identity,
              { displayName: "You", userId: "user-local" },
            ],
            [
              remoteParticipant.identity,
              { displayName: "Mina", userId: "user-remote" },
            ],
          ])
        }
        title="Voice lounge"
      />,
    );

    expect(mockParticipants).toHaveBeenCalledWith({ room });
    expect(screen.getByText("2 connected")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Mina")).toBeTruthy();
  });
});
