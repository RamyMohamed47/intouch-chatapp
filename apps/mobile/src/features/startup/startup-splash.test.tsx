import {
  act,
  fireEvent,
  render,
  type RenderResult,
} from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { StartupSplashOverlay } from "@/features/startup/startup-splash";

jest.mock("@/features/appearance/appearance-provider", () => ({
  useAppearance: () => ({ ready: true }),
}));

jest.mock("@/features/voice/voice-provider", () => ({
  useVoice: () => ({ incomingCall: null }),
}));

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const identity = (value: number) => value;

  return {
    __esModule: true,
    default: { View },
    Easing: {
      bezier: () => identity,
      cubic: identity,
      inOut: () => identity,
      out: () => identity,
      quad: identity,
    },
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useReducedMotion: () => false,
    useSharedValue: (value: number) => React.useRef({ value }).current,
    withDelay: (_delay: number, animation: number) => animation,
    withSequence: (...animations: number[]) => animations.at(-1),
    withTiming: (value: number) => value,
  };
});

const completeHandoff = async (view: RenderResult) => {
  await fireEvent(view.getByTestId("startup-splash"), "layout");
  await fireEvent(
    view.getByTestId("startup-splash-logo", { includeHiddenElements: true }),
    "loadEnd",
  );
};

describe("StartupSplashOverlay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("hands off from the native splash and completes the full intro", async () => {
    const hideNativeSplash = jest.fn(() => Promise.resolve());
    const onDismiss = jest.fn();
    const view = await render(
      <StartupSplashOverlay
        appearanceReady
        hideNativeSplash={hideNativeSplash}
        interrupted={false}
        onDismiss={onDismiss}
        reducedMotion={false}
      />,
    );

    await completeHandoff(view);
    expect(hideNativeSplash).toHaveBeenCalledTimes(1);

    await act(() => jest.advanceTimersByTime(750));
    expect(view.queryByTestId("startup-splash")).toBeTruthy();
    await act(() => jest.advanceTimersByTime(299));
    expect(view.queryByTestId("startup-splash")).toBeTruthy();
    await act(() => jest.advanceTimersByTime(1));

    expect(view.queryByTestId("startup-splash")).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("waits for the theme only until the two-second cutoff", async () => {
    const view = await render(
      <StartupSplashOverlay
        appearanceReady={false}
        interrupted={false}
        reducedMotion={false}
      />,
    );

    await completeHandoff(view);
    await act(() => jest.advanceTimersByTime(1_999));
    expect(view.queryByTestId("startup-splash")).toBeTruthy();
    await act(() => jest.advanceTimersByTime(1));
    await act(() => jest.advanceTimersByTime(300));

    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("uses a short static fade when reduced motion is enabled", async () => {
    const view = await render(
      <StartupSplashOverlay
        appearanceReady
        interrupted={false}
        reducedMotion
      />,
    );

    await completeHandoff(view);
    await act(() => jest.advanceTimersByTime(149));
    expect(view.queryByTestId("startup-splash")).toBeTruthy();
    await act(() => jest.advanceTimersByTime(1));

    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("uses the watchdog when the logo never settles", async () => {
    const hideNativeSplash = jest.fn();
    const view = await render(
      <StartupSplashOverlay
        appearanceReady
        hideNativeSplash={hideNativeSplash}
        interrupted={false}
        reducedMotion={false}
      />,
    );

    await act(() => jest.advanceTimersByTime(3_000));

    expect(hideNativeSplash).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("clears startup timers when the overlay unmounts", async () => {
    const onDismiss = jest.fn();
    const view = await render(
      <StartupSplashOverlay
        appearanceReady
        interrupted={false}
        onDismiss={onDismiss}
        reducedMotion={false}
      />,
    );

    await view.unmount();
    await act(() => jest.advanceTimersByTime(3_000));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses immediately for a ringing call or background transition", async () => {
    const hideForCall = jest.fn();
    const callView = await render(
      <StartupSplashOverlay
        appearanceReady
        hideNativeSplash={hideForCall}
        interrupted
        reducedMotion={false}
      />,
    );
    expect(callView.queryByTestId("startup-splash")).toBeNull();
    expect(hideForCall).toHaveBeenCalledTimes(1);
    await callView.unmount();

    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
    const backgroundView = await render(
      <StartupSplashOverlay
        appearanceReady
        interrupted={false}
        reducedMotion={false}
      />,
    );
    await act(() => appStateListener?.("background"));

    expect(backgroundView.queryByTestId("startup-splash")).toBeNull();
  });

  it("treats a bundled-image failure as a completed handoff", async () => {
    const hideNativeSplash = jest.fn();
    const view = await render(
      <StartupSplashOverlay
        appearanceReady
        hideNativeSplash={hideNativeSplash}
        interrupted={false}
        reducedMotion={false}
      />,
    );

    await fireEvent(view.getByTestId("startup-splash"), "layout");
    await fireEvent(
      view.getByTestId("startup-splash-logo", { includeHiddenElements: true }),
      "error",
      { nativeEvent: { error: "Bundled image unavailable" } },
    );

    expect(hideNativeSplash).toHaveBeenCalledTimes(1);
  });
});
