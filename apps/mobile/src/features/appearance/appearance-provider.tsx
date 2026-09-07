import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import {
  ThemeName,
  themes,
  type ThemeNameValue,
  type ThemeTokens,
} from "@/features/appearance/theme";

const THEME_KEY = "intouch.theme.v1";

interface AppearanceValue {
  name: ThemeNameValue;
  setTheme: (name: ThemeNameValue) => void;
  theme: ThemeTokens;
}

const AppearanceContext = createContext<AppearanceValue | null>(null);

export const AppearanceProvider = ({ children }: PropsWithChildren) => {
  const [name, setName] = useState<ThemeNameValue>(ThemeName.INK);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored && stored in themes) setName(stored as ThemeNameValue);
    });
  }, []);

  const setTheme = (next: ThemeNameValue) => {
    setName(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  };

  return (
    <AppearanceContext.Provider value={{ name, setTheme, theme: themes[name] }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("AppearanceProvider is missing");
  return value;
};
