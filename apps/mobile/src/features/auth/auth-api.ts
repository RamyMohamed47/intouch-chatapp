import {
  authRequestAcceptedResponseSchema,
  mobileAuthResponseSchema,
  mobileRefreshResponseSchema,
  registrationPendingResponseSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from "@intouch/shared/auth";
import { userResponseSchema } from "@intouch/shared/users";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const authApi = {
  login: (input: LoginInput) =>
    apiRequest(
      "/api/v1/auth/mobile/login",
      mobileAuthResponseSchema,
      { method: "POST", body: JSON.stringify(input) },
      false,
    ),
  google: (idToken: string) =>
    apiRequest(
      "/api/v1/auth/mobile/google",
      mobileAuthResponseSchema,
      { method: "POST", body: JSON.stringify({ idToken }) },
      false,
    ),
  refresh: (refreshToken: string) =>
    apiRequest(
      "/api/v1/auth/mobile/refresh",
      mobileRefreshResponseSchema,
      { method: "POST", body: JSON.stringify({ refreshToken }) },
      false,
    ),
  logout: (refreshToken: string) =>
    apiRequest(
      "/api/v1/auth/mobile/logout",
      noContentSchema,
      { method: "POST", body: JSON.stringify({ refreshToken }) },
      false,
    ),
  me: async () =>
    (await apiRequest("/api/v1/auth/me", userResponseSchema)).user,
  register: (input: RegisterInput) =>
    apiRequest(
      "/api/v1/auth/register",
      registrationPendingResponseSchema,
      {
        method: "POST",
        body: JSON.stringify({ ...input, deliveryTarget: "MOBILE" }),
      },
      false,
    ),
  verifyEmail: (input: VerifyEmailInput) =>
    apiRequest(
      "/api/v1/auth/verify-email",
      noContentSchema,
      { method: "POST", body: JSON.stringify(input) },
      false,
    ),
  resendVerification: (input: ResendVerificationInput) =>
    apiRequest(
      "/api/v1/auth/resend-verification",
      authRequestAcceptedResponseSchema,
      {
        method: "POST",
        body: JSON.stringify({ ...input, deliveryTarget: "MOBILE" }),
      },
      false,
    ),
  forgotPassword: (input: ForgotPasswordInput) =>
    apiRequest(
      "/api/v1/auth/forgot-password",
      authRequestAcceptedResponseSchema,
      {
        method: "POST",
        body: JSON.stringify({ ...input, deliveryTarget: "MOBILE" }),
      },
      false,
    ),
  resetPassword: (input: ResetPasswordInput) =>
    apiRequest(
      "/api/v1/auth/reset-password",
      noContentSchema,
      { method: "POST", body: JSON.stringify(input) },
      false,
    ),
};
