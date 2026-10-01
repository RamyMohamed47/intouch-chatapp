import {
  act,
  fireEvent,
  render,
  type RenderResult,
} from "@testing-library/react-native";
import { AppState, Text, View, type AppStateStatus } from "react-native";
import { cancelAnimation, withTiming } from "react-native-reanimated";

import { StartupSplashOverlay } from "@/features/startup/startup-splash";

const mockAnimations: Array<{
  target: number;
  complete: (finished: boolean) => void;
}> = [];
const initialAppState = AppState.currentState;

jest.mock("@/features/appearance/appearance-provider", () => ({
  useAppearance: () => ({ ready: true }),
}));
jest.mock("@/features/voice/voice-provider", () => ({
  useVoice: () => ({ incomingCall: null }),
}));
jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (callback: () => void) => callback(),
}));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const identity = (value: number) => value;
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (component: unknown) => component,
    },
    Easing: { linear: identity, inOut: () => identity, quad: identity },
    cancelAnimation: jest.fn(),
    interpolateColor: () => "#45dfff",
    useAnimatedProps: (factory: () => object) => factory(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useDerivedValue: (factory: () => object) => ({ value: factory() }),
    useReducedMotion: () => false,
    useSharedValue: (value: number) => React.useRef({ value }).current,
    withTiming: jest.fn(
      (
        target: number,
        _config: object,
        complete: (finished: boolean) => void,
      ) => {
        mockAnimations.push({ target, complete });
        return target;
      },
    ),
  };
});

const handoff = async (view: RenderResult) => {
  await fireEvent(view.getByTestId("startup-splash"), "layout");
  await fireEvent(
    view.getByTestId("startup-splash-logo", { includeHiddenElements: true }),
    "load",
    { nativeEvent: {} },
  );
};
const complete = async (target: number, finished = true) => {
  const animation = mockAnimations.find((entry) => entry.target === target);
  expect(animation).toBeDefined();
  await act(() => animation?.complete(finished));
};
const defaults = {
  appearanceReady: true,
  interrupted: false,
  reducedMotion: false,
};

const expectStartupTimersCleared = () => {
  const timerMock = jest.mocked(setTimeout).mock;
  const deadlines = timerMock.calls.flatMap((args, index) =>
    args[1] === 2000 || args[1] === 3000 ? [index] : [],
  );
  expect(deadlines).toHaveLength(2);
  for (const index of deadlines) {
    expect(clearTimeout).toHaveBeenCalledWith(timerMock.results[index]?.value);
  }
};

describe("StartupSplashOverlay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAnimations.length = 0;
    AppState.currentState = "active";
    jest.spyOn(globalThis, "setTimeout");
    jest.spyOn(globalThis, "clearTimeout");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    AppState.currentState = initialAppState;
  });

  it("waits for layout, the image, and asynchronous native handoff before animating", async () => {
    let resolveHide: (() => void) | undefined;
    const hideNativeSplash = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHide = resolve;
        }),
    );
    const onDismiss = jest.fn();
    const view = await render(
      <StartupSplashOverlay
        {...defaults}
        hideNativeSplash={hideNativeSplash}
        onDismiss={onDismiss}
      />,
    );
    expect(hideNativeSplash).not.toHaveBeenCalled();
    await fireEvent(view.getByTestId("startup-splash"), "layout");
    expect(hideNativeSplash).not.toHaveBeenCalled();
    await fireEvent(
      view.getByTestId("startup-splash-logo", { includeHiddenElements: true }),
      "load",
      { nativeEvent: {} },
    );
    expect(hideNativeSplash).toHaveBeenCalledTimes(1);
    expect(withTiming).not.toHaveBeenCalled();
    await act(() => resolveHide?.());
    expect(withTiming).toHaveBeenCalledWith(
      1300,
      expect.objectContaining({ duration: 1300 }),
      expect.any(Function),
    );
    // Elapsed JS time cannot finish the motion: the UI-thread completion drives it.
    await act(() => jest.advanceTimersByTime(1600));
    expect(onDismiss).not.toHaveBeenCalled();
    await complete(1300);
    expect(withTiming).toHaveBeenLastCalledWith(
      0,
      expect.objectContaining({ duration: 300 }),
      expect.any(Function),
    );
    await complete(0);
    expect(view.queryByTestId("startup-splash")).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expectStartupTimersCleared();
  });

  it("does not treat a cancelled motion callback as successful completion", async () => {
    const view = await render(<StartupSplashOverlay {...defaults} />);
    await handoff(view);
    await complete(1300, false);
    expect(mockAnimations.map(({ target }) => target)).toEqual([1300]);
    await act(() => jest.advanceTimersByTime(3000));
    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("waits for theme restoration, bounded to two seconds", async () => {
    const view = await render(
      <StartupSplashOverlay {...defaults} appearanceReady={false} />,
    );
    await handoff(view);
    await complete(1300);
    await act(() => jest.advanceTimersByTime(1999));
    expect(mockAnimations).toHaveLength(1);
    await act(() => jest.advanceTimersByTime(1));
    expect(mockAnimations).toHaveLength(2);
    await complete(0);
    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("starts fading as soon as the restored theme is ready and never restarts the fade", async () => {
    const view = await render(
      <StartupSplashOverlay {...defaults} appearanceReady={false} />,
    );
    await handoff(view);
    await complete(1300);
    await view.rerender(<StartupSplashOverlay {...defaults} />);
    expect(mockAnimations).toHaveLength(2);
    await act(() => jest.advanceTimersByTime(2000));
    expect(mockAnimations).toHaveLength(2);
    await complete(0);
  });

  it("uses only a static 150ms fade for reduced motion", async () => {
    const view = await render(
      <StartupSplashOverlay {...defaults} reducedMotion />,
    );
    await handoff(view);
    expect(mockAnimations.map(({ target }) => target)).toEqual([0]);
    expect(withTiming).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ duration: 150 }),
      expect.any(Function),
    );
    await complete(0);
    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it.each(["throw", "reject"])(
    "continues when the native hide API fails (%s)",
    async (failure) => {
      const hideNativeSplash = () => {
        if (failure === "throw") throw new Error("Unavailable");
        return Promise.reject(new Error("Unavailable"));
      };
      const view = await render(
        <StartupSplashOverlay
          {...defaults}
          hideNativeSplash={hideNativeSplash}
        />,
      );
      await handoff(view);
      await complete(1300);
      await complete(0);
      expect(view.queryByTestId("startup-splash")).toBeNull();
    },
  );

  it("recovers when the image never loads", async () => {
    const hideNativeSplash = jest.fn();
    const view = await render(
      <StartupSplashOverlay
        {...defaults}
        hideNativeSplash={hideNativeSplash}
      />,
    );
    await act(() => jest.advanceTimersByTime(3000));
    expect(hideNativeSplash).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId("startup-splash")).toBeNull();
    expect(withTiming).not.toHaveBeenCalled();
  });

  it("skips decorative motion when the initial image fails", async () => {
    const view = await render(<StartupSplashOverlay {...defaults} />);
    await fireEvent(view.getByTestId("startup-splash"), "layout");
    await fireEvent(
      view.getByTestId("startup-splash-logo", { includeHiddenElements: true }),
      "error",
      { nativeEvent: { error: "Bundled image unavailable" } },
    );
    expect(mockAnimations.map(({ target }) => target)).toEqual([0]);
    await complete(0);
    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("ignores a late handoff after watchdog dismissal", async () => {
    let resolveHide: (() => void) | undefined;
    const view = await render(
      <StartupSplashOverlay
        {...defaults}
        hideNativeSplash={() =>
          new Promise<void>((resolve) => {
            resolveHide = resolve;
          })
        }
      />,
    );
    await handoff(view);
    await act(() => jest.advanceTimersByTime(3000));
    await act(() => resolveHide?.());
    expect(withTiming).not.toHaveBeenCalled();
    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("dismisses for a ringing call and cannot restart after it is cleared", async () => {
    const onDismiss = jest.fn();
    const view = await render(
      <StartupSplashOverlay {...defaults} onDismiss={onDismiss} />,
    );
    await handoff(view);
    await view.rerender(
      <StartupSplashOverlay {...defaults} interrupted onDismiss={onDismiss} />,
    );
    await complete(1300);
    await view.rerender(
      <StartupSplashOverlay {...defaults} onDismiss={onDismiss} />,
    );
    expect(mockAnimations).toHaveLength(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("dismisses before handoff when a ringing call is already present", async () => {
    const hideNativeSplash = jest.fn();
    const view = await render(
      <StartupSplashOverlay
        {...defaults}
        interrupted
        hideNativeSplash={hideNativeSplash}
      />,
    );
    expect(view.queryByTestId("startup-splash")).toBeNull();
    expect(hideNativeSplash).toHaveBeenCalledTimes(1);
    expect(withTiming).not.toHaveBeenCalled();
  });

  it("stops on background and removes its app-state listener", async () => {
    let listener: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, callback) => {
        listener = callback;
        return { remove };
      });
    const view = await render(<StartupSplashOverlay {...defaults} />);
    await handoff(view);
    await act(() => listener?.("background"));
    expect(remove).toHaveBeenCalledTimes(1);
    expectStartupTimersCleared();
    expect(view.queryByTestId("startup-splash")).toBeNull();
  });

  it("cancels on unmount and ignores late animation callbacks", async () => {
    const onDismiss = jest.fn();
    const view = await render(
      <StartupSplashOverlay {...defaults} onDismiss={onDismiss} />,
    );
    await handoff(view);
    await view.unmount();
    await complete(1300);
    await act(() => jest.advanceTimersByTime(3000));
    expect(cancelAnimation).toHaveBeenCalled();
    expectStartupTimersCleared();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(mockAnimations).toHaveLength(1);
  });

  it("keeps the destination mounted while authentication changes underneath", async () => {
    const destination = "/app/workspace/conversation/from-notification";
    const Screen = ({ authenticated }: { authenticated: boolean }) => (
      <View>
        <Text>{authenticated ? destination : "Restoring your session"}</Text>
        <StartupSplashOverlay {...defaults} />
      </View>
    );
    const view = await render(<Screen authenticated={false} />);
    expect(
      view.getByText("Restoring your session", { includeHiddenElements: true }),
    ).toBeTruthy();
    await handoff(view);
    await view.rerender(<Screen authenticated />);
    expect(
      view.getByText(destination, { includeHiddenElements: true }),
    ).toBeTruthy();
    await complete(1300);
    await complete(0);
    expect(view.getByText(destination)).toBeTruthy();
  });

  it("finishes without waiting for slow authentication", async () => {
    const view = await render(
      <View>
        <Text>Restoring your session</Text>
        <StartupSplashOverlay {...defaults} />
      </View>,
    );
    await handoff(view);
    await complete(1300);
    await complete(0);
    expect(view.queryByTestId("startup-splash")).toBeNull();
    expect(view.getByText("Restoring your session")).toBeTruthy();
  });

  it("allows an unknown launch state but skips an already-backgrounded launch", async () => {
    AppState.currentState = "unknown";
    const unknown = await render(<StartupSplashOverlay {...defaults} />);
    expect(unknown.getByTestId("startup-splash")).toBeTruthy();
    await unknown.unmount();
    AppState.currentState = "background";
    const background = await render(<StartupSplashOverlay {...defaults} />);
    expect(background.queryByTestId("startup-splash")).toBeNull();
    expect(withTiming).not.toHaveBeenCalled();
  });

  it("ignores native handoff that resolves after unmount", async () => {
    let resolveHide: (() => void) | undefined;
    const view = await render(
      <StartupSplashOverlay
        {...defaults}
        hideNativeSplash={() =>
          new Promise<void>((resolve) => {
            resolveHide = resolve;
          })
        }
      />,
    );
    await handoff(view);
    await view.unmount();
    await act(() => resolveHide?.());
    expect(withTiming).not.toHaveBeenCalled();
    expectStartupTimersCleared();
  });
});
