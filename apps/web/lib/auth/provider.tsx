"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  clearLocalSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  restoreSession,
  type PublicUser,
} from "@/lib/auth/client";
import { subscribeToAccessToken } from "@/lib/auth/access-token";
import { setSentryUser } from "@/lib/observability/sentry";
import type {
  LoginInput,
  RegisterInput,
  RegistrationPendingResponse,
} from "@intouch/shared/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (input: LoginInput) => Promise<PublicUser>;
  register: (input: RegisterInput) => Promise<RegistrationPendingResponse>;
  restore: () => Promise<PublicUser | null>;
  logout: () => Promise<void>;
  updateUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  const restore = useCallback(async () => {
    const restoredUser = await restoreSession().catch(() => null);
    setUser(restoredUser);
    setStatus(restoredUser ? "authenticated" : "unauthenticated");
    return restoredUser;
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    void setSentryUser(user?.id ?? null);
  }, [user]);

  useEffect(
    () =>
      subscribeToAccessToken((accessToken) => {
        if (accessToken) return;
        setUser(null);
        setStatus("unauthenticated");
      }),
    [],
  );

  const authenticate = async (
    request: () => Promise<PublicUser>,
  ): Promise<PublicUser> => {
    const authenticatedUser = await request();
    setUser(authenticatedUser);
    setStatus("authenticated");
    return authenticatedUser;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      clearLocalSession();
      queryClient.clear();
      setUser(null);
      setStatus("unauthenticated");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        login: (input) => authenticate(() => loginRequest(input)),
        register: (input) => registerRequest(input),
        restore,
        logout,
        updateUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
