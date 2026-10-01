import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  AppearanceProvider,
  useAppearance,
} from "@/features/appearance/appearance-provider";

const AppearanceState = () => {
  const { name, ready } = useAppearance();
  return <Text>{`${ready ? "ready" : "loading"}:${name}`}</Text>;
};

describe("AppearanceProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("restores the saved theme before reporting readiness", async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue("CLOUD");
    const view = await render(
      <AppearanceProvider>
        <AppearanceState />
      </AppearanceProvider>,
    );

    await waitFor(() => expect(view.getByText("ready:CLOUD")).toBeTruthy());
  });

  it("falls back to Ink when theme storage fails", async () => {
    jest
      .mocked(AsyncStorage.getItem)
      .mockRejectedValue(new Error("unavailable"));
    const view = await render(
      <AppearanceProvider>
        <AppearanceState />
      </AppearanceProvider>,
    );

    await waitFor(() => expect(view.getByText("ready:INK")).toBeTruthy());
  });
});
