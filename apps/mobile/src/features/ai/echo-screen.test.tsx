import type { AiResponseRequest } from "@intouch/shared/ai";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import EchoScreen from "@/app/(app)/(tabs)/echo";

const mockInvalidateQueries = jest
  .fn<Promise<void>, [unknown]>()
  .mockResolvedValue(undefined);
const mockRouterPush = jest.fn<void, [unknown]>();
const mockStreamAiResponse = jest.fn<
  Promise<void>,
  [string, AiResponseRequest, AbortSignal, (event: unknown) => void]
>();
const mockUseInfiniteQuery = jest.fn<unknown, [unknown]>();
const mockUseQuery = jest.fn<unknown, [unknown]>();
let mockActiveOrganizationId: string | null = "organization-1";

jest.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: unknown): unknown =>
    mockUseInfiniteQuery(options),
  useQuery: (options: unknown): unknown => mockUseQuery(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock("expo-router", () => ({
  router: { push: (input: unknown) => mockRouterPush(input) },
}));

jest.mock("lucide-react-native", () => ({
  MessageCircle: () => null,
  Search: () => null,
  Send: () => null,
  Sparkles: () => null,
  Square: () => null,
  X: () => null,
}));

jest.mock("@/components/app-shell", () => ({
  MainScreenHeader: () => null,
}));

jest.mock("expo-network", () => ({
  useNetworkState: () => ({ isConnected: true }),
}));

jest.mock("@/features/ai/ai-api", () => ({
  aiApi: {
    acceptConsent: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  },
  streamAiResponse: (
    organizationId: string,
    request: AiResponseRequest,
    signal: AbortSignal,
    onEvent: (event: unknown) => void,
  ) => mockStreamAiResponse(organizationId, request, signal, onEvent),
}));

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

jest.mock("@/features/organizations/workspace-provider", () => ({
  useWorkspace: () => ({ activeOrganizationId: mockActiveOrganizationId }),
}));

const settings = {
  available: true,
  canManage: false,
  dataUseNotice: "AI disclosure",
  disclosureVersion: "v1",
  organizationEnabled: true,
  quota: { userRemaining: 20 },
  userConsentAccepted: true,
};

const renderEcho = () => render(<EchoScreen />);

describe("EchoScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveOrganizationId = "organization-1";
    mockUseQuery.mockImplementation((options) => {
      const { queryKey } = options as { queryKey: readonly unknown[] };
      return queryKey.at(-1) === "ai-settings"
        ? { data: settings, isLoading: false }
        : {
            data: [
              {
                id: "507f1f77bcf86cd799439011",
                kind: "TEXT",
                name: "General",
                type: "CHANNEL",
              },
              {
                id: "507f1f77bcf86cd799439012",
                kind: "VOICE",
                name: "Voice lounge",
                type: "CHANNEL",
              },
            ],
          };
    });
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ directMessages: [], nextCursor: null }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    mockStreamAiResponse.mockImplementation(
      (
        _organizationId: string,
        _request: AiResponseRequest,
        _signal: AbortSignal,
        onEvent: (event: unknown) => void,
      ) => {
        onEvent({ type: "delta", text: "Answer" });
        onEvent({ type: "completed", finishReason: "STOP" });
        return Promise.resolve();
      },
    );
  });

  it("selects an accessible text conversation and sends that exact scope", async () => {
    const screen = await renderEcho();

    await fireEvent.press(
      screen.getByLabelText("Echo scope: Entire workspace"),
    );
    expect(screen.queryByText("Voice lounge")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Use General as Echo context"));
    await fireEvent.changeText(
      screen.getByLabelText("Ask Echo"),
      "What changed?",
    );
    await fireEvent.press(screen.getByLabelText("Send to Echo"));

    await waitFor(() => expect(mockStreamAiResponse).toHaveBeenCalledTimes(1));
    expect(mockStreamAiResponse.mock.calls[0]?.[1]).toMatchObject({
      prompt: "What changed?",
      scope: {
        kind: "CONVERSATION",
        conversationId: "507f1f77bcf86cd799439011",
      },
      task: "ASK",
    });
  });

  it("retries a transient failure on the existing turn with its original request", async () => {
    mockStreamAiResponse
      .mockImplementationOnce(
        (
          _organizationId: string,
          _request: AiResponseRequest,
          _signal: AbortSignal,
          onEvent: (event: unknown) => void,
        ) => {
          onEvent({
            type: "error",
            code: "AI_UNAVAILABLE",
            message: "Try again later",
            requestId: "request-1",
          });
          return Promise.resolve();
        },
      )
      .mockImplementationOnce(
        (
          _organizationId: string,
          _request: AiResponseRequest,
          _signal: AbortSignal,
          onEvent: (event: unknown) => void,
        ) => {
          onEvent({ type: "delta", text: "Recovered" });
          onEvent({ type: "completed", finishReason: "STOP" });
          return Promise.resolve();
        },
      );
    const screen = await renderEcho();

    await fireEvent.changeText(screen.getByLabelText("Ask Echo"), "Retry this");
    await fireEvent.press(screen.getByLabelText("Send to Echo"));
    await waitFor(() =>
      expect(screen.getByText("Try again later")).toBeTruthy(),
    );
    const originalRequest = mockStreamAiResponse.mock.calls[0]?.[1];

    await fireEvent.press(screen.getByText("Retry"));

    await waitFor(() => expect(screen.getByText("Recovered")).toBeTruthy());
    expect(mockStreamAiResponse.mock.calls[1]?.[1]).toEqual(originalRequest);
    expect(screen.getAllByText("Retry this")).toHaveLength(1);
  });

  it("treats cancellation as a non-error terminal state", async () => {
    mockStreamAiResponse.mockImplementation(
      (
        _organizationId: string,
        _request: AiResponseRequest,
        signal: AbortSignal,
      ) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const screen = await renderEcho();

    await fireEvent.changeText(screen.getByLabelText("Ask Echo"), "Stop this");
    await fireEvent.press(screen.getByLabelText("Send to Echo"));
    await fireEvent.press(screen.getByLabelText("Stop Echo response"));

    await waitFor(() =>
      expect(screen.queryByText("Echo is thinking...")).toBeNull(),
    );
    expect(screen.queryByText("Retry")).toBeNull();
    expect(screen.queryByText("aborted")).toBeNull();
  });

  it("opens a returned source at its exact message context", async () => {
    mockStreamAiResponse.mockImplementation(
      (
        _organizationId: string,
        _request: AiResponseRequest,
        _signal: AbortSignal,
        onEvent: (event: unknown) => void,
      ) => {
        onEvent({
          type: "sources",
          sources: [
            {
              conversationId: "channel-1",
              conversationLabel: "General",
              excerpt: "The relevant message",
              messageId: "message-1",
              sourceId: "source-1",
            },
          ],
        });
        onEvent({ type: "completed", finishReason: "STOP" });
        return Promise.resolve();
      },
    );
    const screen = await renderEcho();

    await fireEvent.changeText(
      screen.getByLabelText("Ask Echo"),
      "Find source",
    );
    await fireEvent.press(screen.getByLabelText("Send to Echo"));
    await waitFor(() =>
      expect(screen.getByText("The relevant message")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText("The relevant message"));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/conversation/[conversationId]",
      params: { conversationId: "channel-1", messageId: "message-1" },
    });
  });

  it("clears in-memory history when the active workspace changes", async () => {
    const screen = await renderEcho();

    await fireEvent.changeText(
      screen.getByLabelText("Ask Echo"),
      "Remember me",
    );
    await fireEvent.press(screen.getByLabelText("Send to Echo"));
    await waitFor(() => expect(screen.getByText("Answer")).toBeTruthy());

    mockActiveOrganizationId = "organization-2";
    await screen.rerender(<EchoScreen />);

    await waitFor(() => expect(screen.queryByText("Remember me")).toBeNull());
    expect(screen.getByText("Ask Echo")).toBeTruthy();
  });
});
