import { CallStatus } from "@intouch/shared/voice";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import intouchMark from "../../../../web/public/brand/intouch-mark.png";

import { HandsConnectArtwork } from "./hands-connect-artwork";
import {
  MARK_HEIGHT,
  MARK_WIDTH,
  MOTION_DURATION_MS,
  SPLASH_BACKGROUND,
} from "./splash-artwork";

import { useAppearance } from "@/features/appearance/appearance-provider";
import { useVoice } from "@/features/voice/voice-provider";

interface StartupSplashOverlayProps {
  appearanceReady: boolean;
  interrupted: boolean;
  reducedMotion: boolean;
  hideNativeSplash?: () => void | Promise<void>;
  onDismiss?: () => void;
}

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
  const [imageFailed, setImageFailed] = useState(false);
  const [motionFinished, setMotionFinished] = useState(false);
  const [themeTimedOut, setThemeTimedOut] = useState(false);
  const mounted = useRef(false);
  const dismissed = useRef(false);
  const animationStarted = useRef(false);
  const fadeStarted = useRef(false);
  const hidePromise = useRef<Promise<void> | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const elapsed = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);
  const { width, height } = useWindowDimensions();
  const logoWidth = Math.min(
    MARK_WIDTH,
    Math.max(1, width - 32),
    Math.max(1, height - 120),
  );

  const hideNative = useCallback(() => {
    if (!hidePromise.current) {
      // Normalize synchronous throws and asynchronous failures into one settled handoff.
      hidePromise.current = Promise.resolve()
        .then(() => hideNativeSplash())
        .catch(() => undefined);
    }
    return hidePromise.current;
  }, [hideNativeSplash]);

  const finish = useCallback(() => {
    if (!mounted.current || dismissed.current) return;
    dismissed.current = true;
    void hideNative();
    cancelAnimation(elapsed);
    cancelAnimation(overlayOpacity);
    cleanup.current?.();
    setVisible(false);
    onDismissRef.current?.();
  }, [elapsed, hideNative, overlayOpacity]);

  useEffect(() => {
    mounted.current = true;
    const themeTimer = setTimeout(() => setThemeTimedOut(true), 2_000);
    const watchdog = setTimeout(finish, 3_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") finish();
    });
    cleanup.current = () => {
      clearTimeout(themeTimer);
      clearTimeout(watchdog);
      subscription.remove();
      cleanup.current = null;
    };
    return () => {
      mounted.current = false;
      cleanup.current?.();
      cancelAnimation(elapsed);
      cancelAnimation(overlayOpacity);
    };
  }, [elapsed, finish, overlayOpacity]);

  const completeMotion = useCallback(() => {
    if (mounted.current && !dismissed.current) setMotionFinished(true);
  }, []);

  useEffect(() => {
    if (
      interrupted ||
      AppState.currentState === "background" ||
      AppState.currentState === "inactive"
    )
      finish();
  }, [finish, interrupted]);

  useEffect(() => {
    if (
      !layoutReady ||
      !imageReady ||
      animationStarted.current ||
      dismissed.current
    )
      return;
    animationStarted.current = true;
    void hideNative().then(() => {
      if (!mounted.current || dismissed.current) return;
      if (reducedMotion || imageFailed) {
        completeMotion();
        return;
      }
      elapsed.value = withTiming(
        MOTION_DURATION_MS,
        { duration: MOTION_DURATION_MS, easing: Easing.linear },
        (finished) => {
          if (finished) scheduleOnRN(completeMotion);
        },
      );
    });
  }, [
    completeMotion,
    elapsed,
    hideNative,
    imageFailed,
    imageReady,
    layoutReady,
    reducedMotion,
  ]);

  useEffect(() => {
    if (
      !motionFinished ||
      (!appearanceReady && !themeTimedOut) ||
      dismissed.current ||
      fadeStarted.current
    )
      return;
    fadeStarted.current = true;
    overlayOpacity.value = withTiming(
      0,
      {
        duration: reducedMotion || imageFailed ? 150 : 300,
        easing: Easing.inOut(Easing.quad),
      },
      (finished) => {
        if (finished) scheduleOnRN(finish);
      },
    );
  }, [
    appearanceReady,
    finish,
    imageFailed,
    motionFinished,
    overlayOpacity,
    reducedMotion,
    themeTimedOut,
  ]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const imageStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - elapsed.value / 180),
  }));
  if (!visible) return null;

  return (
    <Animated.View
      accessibilityLabel="InTouch, starting"
      accessibilityRole="progressbar"
      accessibilityViewIsModal
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
        style={{
          width: logoWidth,
          height: (logoWidth * MARK_HEIGHT) / MARK_WIDTH,
        }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
          <Image
            accessible={false}
            contentFit="contain"
            onError={() => {
              setImageFailed(true);
              setImageReady(true);
            }}
            onLoad={() => setImageReady(true)}
            source={intouchMark}
            style={StyleSheet.absoluteFill}
            testID="startup-splash-logo"
          />
        </Animated.View>
        {!reducedMotion && !imageFailed ? (
          <HandsConnectArtwork elapsed={elapsed} width={logoWidth} />
        ) : null}
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
    backgroundColor: SPLASH_BACKGROUND,
    elevation: 10_000,
    justifyContent: "center",
    zIndex: 10_000,
  },
});
