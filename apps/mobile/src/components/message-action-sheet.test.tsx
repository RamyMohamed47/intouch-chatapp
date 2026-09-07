import { fireEvent, render } from "@testing-library/react-native";

import { MessageActionSheet } from "@/components/message-action-sheet";

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

describe("MessageActionSheet", () => {
  it("shows reactions and owner actions only after it becomes visible", async () => {
    const hidden = await render(
      <MessageActionSheet
        currentReaction={null}
        isOwnMessage
        onClose={jest.fn()}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onReact={jest.fn()}
        pending={false}
        visible={false}
      />,
    );

    expect(hidden.queryByText("React")).toBeNull();
    await hidden.rerender(
      <MessageActionSheet
        currentReaction={null}
        isOwnMessage
        onClose={jest.fn()}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onReact={jest.fn()}
        pending={false}
        visible
      />,
    );

    expect(hidden.getByText("React")).toBeTruthy();
    expect(hidden.getByText("Edit caption")).toBeTruthy();
    expect(hidden.getByText("Delete message")).toBeTruthy();
  });

  it("marks the current reaction and dispatches a replacement", async () => {
    const onReact = jest.fn();
    const screen = await render(
      <MessageActionSheet
        currentReaction={"\u{1F44D}"}
        isOwnMessage={false}
        onClose={jest.fn()}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onReact={onReact}
        pending={false}
        visible
      />,
    );

    expect(
      screen.getByLabelText("Remove \u{1F44D}").props.accessibilityState,
    ).toEqual({ disabled: false, selected: true });
    expect(screen.queryByText("Edit caption")).toBeNull();

    await fireEvent.press(screen.getByLabelText("React with \u{1F389}"));
    expect(onReact).toHaveBeenCalledWith("\u{1F389}");
  });
});
