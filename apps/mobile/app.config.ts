import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Intouch Chat App",
  slug: "intouch-mobile",
  owner: "ramymohamed47",
  version: "1.0.0",
  orientation: "default",
  scheme: "intouch",
  extra: {
    ...config.extra,
    eas: {
      projectId: "89e46978-2270-438c-93e1-9c32506ea6ed",
    },
  },
  userInterfaceStyle: "automatic",
  icon: "./assets/images/icon.png",
  ios: {
    bundleIdentifier: "com.ramymohamed.intouch",
    supportsTablet: true,
  },
  android: {
    package: "com.ramymohamed.intouch",
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      backgroundColor: "#07101f",
      foregroundImage: "./assets/images/android-icon-foreground.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#07101f",
        image: "./assets/images/splash-icon.png",
        imageWidth: 96,
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
