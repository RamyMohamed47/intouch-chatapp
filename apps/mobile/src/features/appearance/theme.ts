export const ThemeName = {
  INK: "INK",
  CLOUD: "CLOUD",
  AURORA: "AURORA",
  EMBER: "EMBER",
} as const;

export type ThemeNameValue = (typeof ThemeName)[keyof typeof ThemeName];

export interface ThemeTokens {
  accent: string;
  accentSoft: string;
  background: string;
  border: string;
  danger: string;
  muted: string;
  panel: string;
  panelStrong: string;
  success: string;
  text: string;
}

export const themes: Record<ThemeNameValue, ThemeTokens> = {
  INK: {
    accent: "#2f9dff",
    accentSoft: "#0c2d52",
    background: "#050b16",
    border: "#1b2b44",
    danger: "#ff5c72",
    muted: "#93a4bf",
    panel: "#0a1425",
    panelStrong: "#101d31",
    success: "#3ed598",
    text: "#edf5ff",
  },
  CLOUD: {
    accent: "#006ec9",
    accentSoft: "#d9edff",
    background: "#edf5fa",
    border: "#c7d8e3",
    danger: "#b4233b",
    muted: "#5e7180",
    panel: "#ffffff",
    panelStrong: "#e3eef5",
    success: "#087f5b",
    text: "#102330",
  },
  AURORA: {
    accent: "#00b8a9",
    accentSoft: "#123f48",
    background: "#07191f",
    border: "#1a4650",
    danger: "#ff6b6b",
    muted: "#96b4b8",
    panel: "#0b252c",
    panelStrong: "#10343d",
    success: "#64df9c",
    text: "#ecfffb",
  },
  EMBER: {
    accent: "#ff8b37",
    accentSoft: "#4a2819",
    background: "#1a0d0a",
    border: "#513024",
    danger: "#ff677d",
    muted: "#c1a093",
    panel: "#28130e",
    panelStrong: "#381c14",
    success: "#7bd88f",
    text: "#fff4ed",
  },
};
