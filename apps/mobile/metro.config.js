import sentryMetro from "@sentry/react-native/metro.js";

const { getSentryExpoConfig } = sentryMetro;

export default getSentryExpoConfig(import.meta.dirname, {
  annotateReactComponents: false,
  includeWebReplay: false,
});
