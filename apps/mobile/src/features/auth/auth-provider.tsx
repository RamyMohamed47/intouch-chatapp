import type { PublicUserDto } from "@intouch/shared/users";
import {
  GoogleOneTapSignIn,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from "react-native-nitro-google-signin";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";

import { configureAuthTransport } from "@/core/api/client";
import { mobileConfig } from "@/core/config";
import { authApi } from "@/features/auth/auth-api";
import { isSessionRejected } from "@/features/auth/session-policy";
import { sessionStore } from "@/features/auth/session-store";
import { pushDeviceStore } from "@/features/push/push-device-store";

type AuthStatus =
  "loading" | "authenticated" | "unauthenticated" | "unreachable";

interface AuthContextValue {
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  retry: () => void;
  status: AuthStatus;
  updateUser: (user: PublicUserDto) => void;
  user: PublicUserDto | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

GoogleOneTapSignIn.configure({ webClientId: mobileConfig.googleWebClientId });

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUserDto | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const setSession = useCallback(
    async (next: {
      accessToken: string;
      refreshToken: string;
      user?: PublicUserDto;
    }) => {
      accessTokenRef.current = next.accessToken;
      setAccessToken(next.accessToken);
      await sessionStore.setRefreshToken(next.refreshToken);
      if (next.user) setUser(next.user);
      setStatus("authenticated");
    },
    [],
  );

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
    await sessionStore.clearRefreshToken();
  }, []);

  const refresh = useCallback(() => {
    refreshPromiseRef.current ??= (async () => {
      const refreshToken = await sessionStore.getRefreshToken();
      if (!refreshToken) return null;

      try {
        const result = await authApi.refresh(refreshToken);
        accessTokenRef.current = result.accessToken;
        setAccessToken(result.accessToken);
        await sessionStore.setRefreshToken(result.refreshToken);
        return result.accessToken;
      } catch (error) {
        if (isSessionRejected(error)) await clearSession();
        return null;
      }
    })().finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
  }, [clearSession]);

  const restore = useCallback(async () => {
    const token = await refresh();
    if (!token) {
      // A stored credential that could not be checked is kept for a retry.
      setStatus(
        (await sessionStore.getRefreshToken())
          ? "unreachable"
          : "unauthenticated",
      );
      return;
    }

    try {
      setUser(await authApi.me());
      setStatus("authenticated");
    } catch (error) {
      if (isSessionRejected(error)) {
        await clearSession();
      } else {
        setStatus("unreachable");
      }
    }
  }, [clearSession, refresh]);

  const retry = useCallback(() => {
    setStatus("loading");
    void restore();
  }, [restore]);

  useEffect(() => {
    configureAuthTransport({
      getAccessToken: () => accessTokenRef.current,
      refresh,
    });

    void restore();
  }, [refresh, restore]);

  useEffect(() => {
    if (status !== "unreachable") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") retry();
    });
    return () => subscription.remove();
  }, [retry, status]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login({ email, password });
      await setSession(result);
    },
    [setSession],
  );

  const loginWithGoogle = useCallback(async () => {
    await GoogleOneTapSignIn.checkPlayServices();
    let response = await GoogleOneTapSignIn.signIn();
    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.createAccount();
    }
    if (!isSuccessResponse(response) || !response.data.idToken) return;

    await setSession(await authApi.google(response.data.idToken));
  }, [setSession]);

  const logout = useCallback(async () => {
    const [refreshToken, installationId] = await Promise.all([
      sessionStore.getRefreshToken(),
      pushDeviceStore.getInstallationId(),
    ]);
    await clearSession();

    await Promise.allSettled([
      refreshToken
        ? authApi.logout(refreshToken, installationId)
        : Promise.resolve(),
      GoogleOneTapSignIn.signOut(),
    ]);
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        login,
        loginWithGoogle,
        logout,
        refresh,
        retry,
        status,
        updateUser: setUser,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
};
