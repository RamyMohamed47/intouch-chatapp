import { CallStatus } from "@intouch/shared/voice";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  AppState,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import intouchMark from "../../../../web/public/brand/intouch-mark.png";

import { useAppearance } from "@/features/appearance/appearance-provider";
import { useVoice } from "@/features/voice/voice-provider";

const BRAND_BACKGROUND = "#07101f";
const BLUE = "#168cff";
const AMBER = "#ff9f1c";
const MOTION_DURATION_MS = 750;
const FADE_DURATION_MS = 300;
const REDUCED_FADE_DURATION_MS = 150;
const THEME_TIMEOUT_MS = 2_000;
const WATCHDOG_TIMEOUT_MS = 3_000;

type TimerRef = RefObject<ReturnType<typeof setTimeout> | null>;

interface StartupSplashOverlayProps {
  appearanceReady: boolean;
  interrupted: boolean;
  reducedMotion: boolean;
  hideNativeSplash?: () => void | Promise<void>;
  onDismiss?: () => void;
}

const clearTimer = (timer: TimerRef) => {
  if (timer.current) clearTimeout(timer.current);
  timer.current = null;
};

const defaultHideNativeSplash = () => SplashScreen.hideAsync();

export const StartupSplashOverlay = ({
  appearanceReady,
  interrupted,
  reducedMotion,
  hideNativeSplash = defaultHideNativeSplash,
  onDismiss,
}: StartupSplashOverlayProps) => {
  const [visible, setVisible] = useState(true);
  const [layoutReady, setLayoutReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [motionFinished, setMotionFinished] = useState(false);
  const [themeTimedOut, setThemeTimedOut] = useState(false);
  const nativeSplashHidden = useRef(false);
  const animationStarted = useRef(false);
  const dismissed = useRef(false);
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overlayOpacity = useSharedValue(1);
  const logoRotation = useSharedValue(reducedMotion ? 0 : -8);
  const logoScale = useSharedValue(reducedMotion ? 1 : 0.94);
  const bluePulseOpacity = useSharedValue(0);
  const bluePulseScale = useSharedValue(0.45);
  const amberPulseOpacity = useSharedValue(0);
  const amberPulseScale = useSharedValue(0.35);
  const wordmarkOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const wordmarkOffset = useSharedValue(reducedMotion ? 0 : 12);

  const hideNative = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    try {
      void Promise.resolve(hideNativeSplash()).catch(() => undefined);
    } catch {
      // The React overlay can still finish if the native splash API is unavailable.
    }
  }, [hideNativeSplash]);

  const finish = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    hideNative();
    clearTimer(motionTimer);
    clearTimer(fadeTimer);
    clearTimer(themeTimer);
    clearTimer(watchdogTimer);
    cancelAnimation(overlayOpacity);
    cancelAnimation(logoRotation);
    cancelAnimation(logoScale);
    cancelAnimation(bluePulseOpacity);
    cancelAnimation(bluePulseScale);
    cancelAnimation(amberPulseOpacity);
    cancelAnimation(amberPulseScale);
    cancelAnimation(wordmarkOpacity);
    cancelAnimation(wordmarkOffset);
    setVisible(false);
    onDismiss?.();
  }, [
    amberPulseOpacity,
    amberPulseScale,
    bluePulseOpacity,
    bluePulseScale,
    hideNative,
    logoRotation,
    logoScale,
    onDismiss,
    overlayOpacity,
    wordmarkOffset,
    wordmarkOpacity,
  ]);

  useEffect(() => {
    themeTimer.current = setTimeout(
      () => setThemeTimedOut(true),
      THEME_TIMEOUT_MS,
    );
    watchdogTimer.current = setTimeout(finish, WATCHDOG_TIMEOUT_MS);

    return () => {
      clearTimer(motionTimer);
      clearTimer(fadeTimer);
      clearTimer(themeTimer);
      clearTimer(watchdogTimer);
    };
  }, [finish]);

  useEffect(() => {
    if (!layoutReady || !imageReady || animationStarted.current) return;
    animationStarted.current = true;
    hideNative();

    if (reducedMotion) {
      setMotionFinished(true);
      return;
    }

    const settle = Easing.bezier(0.22, 1, 0.36, 1);
    logoRotation.value = withTiming(0, {
      duration: 350,
      easing: settle,
    });
    logoScale.value = withSequence(
      withTiming(1.03, { duration: 280, easing: settle }),
      withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) }),
    );
    bluePulseScale.value = withDelay(
      350,
      withTiming(2.7, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    bluePulseOpacity.value = withDelay(
      350,
      withSequence(
        withTiming(0.88, { duration: 120 }),
        withTiming(0, { duration: 280 }),
      ),
    );
    amberPulseScale.value = withDelay(
      410,
      withTiming(2.25, { duration: 340, easing: Easing.out(Easing.cubic) }),
    );
    amberPulseOpacity.value = withDelay(
      410,
      withSequence(
        withTiming(0.72, { duration: 100 }),
        withTiming(0, { duration: 240 }),
      ),
    );
    wordmarkOpacity.value = withDelay(350, withTiming(1, { duration: 400 }));
    wordmarkOffset.value = withDelay(
      350,
      withTiming(0, { duration: 400, easing: settle }),
    );
    motionTimer.current = setTimeout(
      () => setMotionFinished(true),
      MOTION_DURATION_MS,
    );
  }, [
    amberPulseOpacity,
    amberPulseScale,
    bluePulseOpacity,
    bluePulseScale,
    hideNative,
    imageReady,
    layoutReady,
    logoRotation,
    logoScale,
    reducedMotion,
    wordmarkOffset,
    wordmarkOpacity,
  ]);

  useEffect(() => {
    if (!motionFinished || (!appearanceReady && !themeTimedOut)) return;
    clearTimer(themeTimer);
    const duration = reducedMotion
      ? REDUCED_FADE_DURATION_MS
      : FADE_DURATION_MS;
    overlayOpacity.value = withTiming(0, {
      duration,
      easing: Easing.inOut(Easing.quad),
    });
    fadeTimer.current = setTimeout(finish, duration);
  }, [
    appearanceReady,
    finish,
    motionFinished,
    overlayOpacity,
    reducedMotion,
    themeTimedOut,
  ]);

  useEffect(() => {
    if (interrupted) finish();
  }, [finish, interrupted]);

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state !== "active") finish();
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [finish]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${logoRotation.value}deg` },
      { scale: logoScale.value },
    ],
  }));
  const bluePulseStyle = useAnimatedStyle(() => ({
    opacity: bluePulseOpacity.value,
    transform: [{ scale: bluePulseScale.value }],
  }));
  const amberPulseStyle = useAnimatedStyle(() => ({
    opacity: amberPulseOpacity.value,
    transform: [{ scale: amberPulseScale.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkOffset.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityLabel="InTouch, starting"
      accessibilityRole="progressbar"
      accessible
      onLayout={() => setLayoutReady(true)}
      pointerEvents="auto"
      style={[styles.overlay, overlayStyle]}
      testID="startup-splash"
    >
      <StatusBar style="light" />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.stage}
      >
        <Animated.View style={[styles.logoFrame, logoStyle]}>
          <Image
            accessible={false}
            contentFit="contain"
            onError={() => setImageReady(true)}
            onLoadEnd={() => setImageReady(true)}
            source={intouchMark}
            style={styles.logo}
            testID="startup-splash-logo"
          />
          {!reducedMotion ? (
            <View style={styles.contactPoint}>
              <Animated.View style={[styles.bluePulse, bluePulseStyle]} />
              <Animated.View style={[styles.amberPulse, amberPulseStyle]} />
              <View style={styles.contactCore} />
            </View>
          ) : null}
        </Animated.View>
        <Animated.View style={[styles.wordmark, wordmarkStyle]}>
          <Text accessible={false} style={[styles.word, styles.wordAmber]}>
            In
          </Text>
          <Text accessible={false} style={[styles.word, styles.wordBlue]}>
            Touch
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

export const StartupSplash = () => {
  const { ready } = useAppearance();
  const { incomingCall } = useVoice();
  const reducedMotion = useReducedMotion();

  return (
    <StartupSplashOverlay
      appearanceReady={ready}
      interrupted={incomingCall?.status === CallStatus.RINGING}
      reducedMotion={reducedMotion}
    />
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: BRAND_BACKGROUND,
    elevation: 10_000,
    justifyContent: "center",
    zIndex: 10_000,
  },
  stage: { alignItems: "center", justifyContent: "center" },
  logoFrame: {
    alignItems: "center",
    height: 130,
    justifyContent: "center",
    width: 220,
  },
  logo: { height: 130, width: 220 },
  contactPoint: {
    height: 1,
    left: 110,
    position: "absolute",
    top: 61,
    width: 1,
  },
  bluePulse: {
    backgroundColor: "rgba(22, 140, 255, 0.13)",
    borderColor: BLUE,
    borderRadius: 25,
    borderWidth: 2,
    height: 50,
    left: -25,
    position: "absolute",
    top: -25,
    width: 50,
  },
  amberPulse: {
    borderColor: AMBER,
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    left: -18,
    position: "absolute",
    top: -18,
    width: 36,
  },
  contactCore: {
    backgroundColor: "#eaf7ff",
    borderColor: BLUE,
    borderRadius: 7,
    borderWidth: 3,
    height: 14,
    left: -7,
    position: "absolute",
    shadowColor: BLUE,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    top: -7,
    width: 14,
  },
  wordmark: {
    flexDirection: "row",
    marginTop: 22,
  },
  word: {
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  wordAmber: { color: AMBER },
  wordBlue: { color: BLUE },
});
