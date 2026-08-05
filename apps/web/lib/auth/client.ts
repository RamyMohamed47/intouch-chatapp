import {
  authResponseSchema,
  type LoginInput,
  type RegisterInput,
} from "@intouch/shared/auth";
import { userResponseSchema, type PublicUserDto } from "@intouch/shared/users";

import { apiRequest, refreshAccessToken } from "@/lib/api/client";
import { setAccessToken } from "@/lib/auth/access-token";

export type PublicUser = PublicUserDto;

const authenticate = async (
  endpoint: "/api/v1/auth/login" | "/api/v1/auth/register",
  input: LoginInput | RegisterInput,
) => {
  const result = await apiRequest(
    endpoint,
    authResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    false,
  );
  setAccessToken(result.accessToken);
  return result.user;
};

export const register = (input: RegisterInput) =>
  authenticate("/api/v1/auth/register", input);

export const login = (input: LoginInput) =>
  authenticate("/api/v1/auth/login", input);

export const getCurrentUser = async () =>
  (
    await apiRequest("/api/v1/auth/me", userResponseSchema, {
      method: "GET",
    })
  ).user;

export const restoreSession = async () => {
  const accessToken = await refreshAccessToken();
  return accessToken ? getCurrentUser() : null;
};

export const startGoogleSignIn = () => {
  window.location.assign("/api/v1/auth/oauth/google");
};

export const clearLocalSession = () => {
  setAccessToken(null);
};
