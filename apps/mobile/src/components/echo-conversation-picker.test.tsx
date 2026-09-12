import { fireEvent, render } from "@testing-library/react-native";

import { EchoConversationPicker } from "@/components/echo-conversation-picker";

jest.mock("lucide-react-native", () => ({
  MessageCircle: () => null,
  Search: () => null,
  X: () => null,
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

const options = [
  { id: "channel-1", label: "Engineering", type: "CHANNEL" as const },
  { id: "direct-1", label: "Mina", type: "DIRECT" as const },
];

describe("EchoConversationPicker", () => {
  it("selects workspace or conversation context from the searchable sheet", async () => {
    const onSelect = jest.fn();
    const screen = await render(
      <EchoConversationPicker
        allowWorkspace
        hasMoreDirectMessages={false}
        loadingMoreDirectMessages={false}
        onLoadMoreDirectMessages={jest.fn()}
        onSelect={onSelect}
        options={options}
        selected={null}
      />,
    );

    await fireEvent.press(
      screen.getByLabelText("Echo scope: Entire workspace"),
    );
    expect(screen.getAllByText("Entire workspace")).toHaveLength(2);

    await fireEvent.changeText(
      screen.getByLabelText("Search Echo conversations"),
      "mina",
    );
    expect(screen.queryByText("Engineering")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Use Mina as Echo context"));

    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  it("loads another direct-message page without changing the selection", async () => {
    const onLoadMore = jest.fn();
    const onSelect = jest.fn();
    const screen = await render(
      <EchoConversationPicker
        allowWorkspace={false}
        hasMoreDirectMessages
        loadingMoreDirectMessages={false}
        onLoadMoreDirectMessages={onLoadMore}
        onSelect={onSelect}
        options={options}
        selected={options[0] ?? null}
      />,
    );

    await fireEvent.press(screen.getByLabelText("Echo scope: Engineering"));
    await fireEvent.press(screen.getByText("Load more direct chats"));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
