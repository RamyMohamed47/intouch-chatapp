import {
  authRequestAcceptedResponseSchema,
  authResponseSchema,
  registrationPendingResponseSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from "@intouch/shared/auth";
import { userResponseSchema, type PublicUserDto } from "@intouch/shared/users";

import {
  apiRequest,
  noContentSchema,
  refreshAccessToken,
} from "@/lib/api/client";
import { setAccessToken } from "@/lib/auth/access-token";

export type PublicUser = PublicUserDto;

const authenticate = async (
  endpoint: "/api/v1/auth/login",
  input: LoginInput,
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
  apiRequest(
    "/api/v1/auth/register",
    registrationPendingResponseSchema,
    { method: "POST", body: JSON.stringify(input) },
    false,
  );

export const login = (input: LoginInput) =>
  authenticate("/api/v1/auth/login", input);

export const verifyEmail = (input: VerifyEmailInput) =>
  apiRequest(
    "/api/v1/auth/verify-email",
    noContentSchema,
    { method: "POST", body: JSON.stringify(input) },
    false,
  );

export const resendVerification = (input: ResendVerificationInput) =>
  apiRequest(
    "/api/v1/auth/resend-verification",
    authRequestAcceptedResponseSchema,
    { method: "POST", body: JSON.stringify(input) },
    false,
  );

export const forgotPassword = (input: ForgotPasswordInput) =>
  apiRequest(
    "/api/v1/auth/forgot-password",
    authRequestAcceptedResponseSchema,
    { method: "POST", body: JSON.stringify(input) },
    false,
  );

export const resetPassword = (input: ResetPasswordInput) =>
  apiRequest(
    "/api/v1/auth/reset-password",
    noContentSchema,
    { method: "POST", body: JSON.stringify(input) },
    false,
  );

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

export const logout = async () => {
  await apiRequest(
    "/api/v1/auth/logout",
    noContentSchema,
    {
      method: "POST",
      headers: { "X-CSRF-Protection": "1" },
    },
    false,
  );
  setAccessToken(null);
};

export const clearLocalSession = () => {
  setAccessToken(null);
};
