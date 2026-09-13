import type { ConfigContext, ExpoConfig } from "expo/config";

const brandAssets = "../web/public/brand";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Intouch Chat App",
  slug: "intouch-mobile",
  owner: "ramymohamed47",
  version: "1.0.0",
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://u.expo.dev/89e46978-2270-438c-93e1-9c32506ea6ed",
  },
  orientation: "default",
  scheme: "intouch",
  extra: {
    ...config.extra,
    eas: {
      projectId: "89e46978-2270-438c-93e1-9c32506ea6ed",
    },
  },
  userInterfaceStyle: "automatic",
  icon: `${brandAssets}/intouch-icon-512.png`,
  ios: {
    bundleIdentifier: "com.ramymohamed.intouch",
    supportsTablet: true,
    infoPlist: {
      UIBackgroundModes: ["audio"],
      NSMicrophoneUsageDescription:
        "InTouch uses your microphone for voice and video calls.",
      NSCameraUsageDescription:
        "InTouch uses your camera when you enable video calls.",
    },
  },
  android: {
    package: "com.ramymohamed.intouch",
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      backgroundColor: "#07101f",
      foregroundImage: `${brandAssets}/intouch-mark.png`,
    },
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
      "android.permission.FOREGROUND_SERVICE_CAMERA",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
      "android.permission.POST_NOTIFICATIONS",
    ],
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  plugins: [
    "expo-router",
    [
      "@livekit/react-native-expo-plugin",
      {
        android: {
          audioType: "communication",
          enableScreenShareService: true,
        },
        ios: { enableMultitaskingCameraAccess: false },
      },
    ],
    "@config-plugins/react-native-webrtc",
    "./plugins/with-voice-foreground-service.cjs",
    "expo-audio",
    "@sentry/react-native/expo",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        color: "#168cff",
        defaultChannel: "intouch-activity-v2",
        enableBackgroundRemoteNotifications: true,
        sounds: ["./assets/audio/intouch-call.wav"],
      },
    ],
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#07101f",
        image: `${brandAssets}/intouch-mark.png`,
        imageWidth: 220,
      },
    ],
    [
      "react-native-nitro-google-signin",
      {
        iosUrlScheme:
          process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ??
          "com.googleusercontent.apps.intouch-ios-client",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
