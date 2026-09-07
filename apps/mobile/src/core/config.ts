const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const publicEnvironmentValue = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const apiUrl = publicEnvironmentValue(
  process.env.EXPO_PUBLIC_API_URL,
  "http://127.0.0.1:3000",
);
const googleWebClientId = publicEnvironmentValue(
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  "unconfigured.apps.googleusercontent.com",
);

export const mobileConfig = {
  apiUrl: trimTrailingSlash(apiUrl),
  googleWebClientId,
} as const;
