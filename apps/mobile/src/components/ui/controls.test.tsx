import { fireEvent, render } from "@testing-library/react-native";

import { BackButton } from "@/components/ui/controls";

jest.mock("lucide-react-native", () => ({ ArrowLeft: () => null }));

jest.mock("@/features/appearance/appearance-provider", () => ({
  useAppearance: () => ({
    theme: {
      border: "#1b2b44",
      panelStrong: "#101d31",
      text: "#edf5ff",
    },
  }),
}));

describe("BackButton", () => {
  it("renders an accessible icon-only back control", async () => {
    const onPress = jest.fn();
    const screen = await render(<BackButton onPress={onPress} />);

    expect(screen.queryByText("Back")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
