import { fireEvent, render } from "@testing-library/react-native";

import ChatsScreen from "@/app/(app)/(tabs)/chats";

const mockDirectMutation = jest.fn<void, [string]>();
const mockUseInfiniteQuery = jest.fn<unknown, [unknown]>();
const mockUseMutation = jest.fn<unknown, [unknown]>();
const mockUseQuery = jest.fn<unknown, [unknown]>();

jest.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: unknown): unknown =>
    mockUseInfiniteQuery(options),
  useMutation: (options: unknown): unknown => mockUseMutation(options),
  useQuery: (options: unknown): unknown => mockUseQuery(options),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

jest.mock("lucide-react-native", () => ({
  Hash: () => null,
  Plus: () => null,
  Volume2: () => null,
}));

jest.mock("@/components/app-shell", () => ({
  MainScreenHeader: () => null,
}));

jest.mock("@/components/user-avatar", () => ({
  UserAvatar: () => null,
}));

jest.mock("expo-network", () => ({
  useNetworkState: () => ({ isConnected: true }),
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

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "current-user" } }),
}));

jest.mock("@/features/organizations/workspace-provider", () => ({
  useWorkspace: () => ({ activeOrganizationId: "organization-1" }),
}));

describe("ChatsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation((options) => {
      const { queryKey } = options as { queryKey: readonly unknown[] };
      return queryKey.at(-1) === "members"
        ? {
            data: [
              {
                membershipId: "membership-1",
                role: "MEMBER",
                user: {
                  avatarAssetId: null,
                  avatarUrl: null,
                  displayName: "Mina",
                  id: "other-user",
                  status: "ONLINE",
                },
              },
            ],
            isLoading: false,
          }
        : { data: [], isRefetching: false, refetch: jest.fn() };
    });
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ directMessages: [], nextCursor: null }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    mockUseMutation.mockReturnValue({
      error: null,
      isError: false,
      isPending: false,
      mutate: mockDirectMutation,
      reset: jest.fn(),
      variables: undefined,
    });
  });

  it("opens the new-DM picker and starts a conversation with the chosen member", async () => {
    const screen = await render(<ChatsScreen />);

    await fireEvent.press(screen.getByLabelText("Start a direct message"));
    expect(screen.getByText("Start a conversation")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Message Mina"));

    expect(mockDirectMutation).toHaveBeenCalledWith("other-user");
  });
});
