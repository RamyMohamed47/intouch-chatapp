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
import type { LoginInput, RegisterInput } from "@intouch/shared/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (input: LoginInput) => Promise<PublicUser>;
  register: (input: RegisterInput) => Promise<PublicUser>;
  restore: () => Promise<PublicUser | null>;
  logout: () => Promise<void>;
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
        register: (input) => authenticate(() => registerRequest(input)),
        restore,
        logout,
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
