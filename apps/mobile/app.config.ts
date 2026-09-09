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
  },
  android: {
    package: "com.ramymohamed.intouch",
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      backgroundColor: "#07101f",
      foregroundImage: `${brandAssets}/intouch-mark.png`,
    },
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  plugins: [
    "expo-router",
    "@sentry/react-native/expo",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        color: "#168cff",
        defaultChannel: "intouch-activity-v2",
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
