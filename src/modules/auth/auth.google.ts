import {
  OAuth2Client,
  type GenerateAuthUrlOpts,
  type TokenPayload,
} from "google-auth-library";

import {
  GoogleProviderUnavailableError,
  InvalidGoogleAuthenticationError,
} from "./auth.errors.js";
import type { GoogleOAuthClient } from "./auth.types.js";

export interface GoogleOAuthConfig {
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
}

type GoogleOAuthOperation = "code_exchange" | "id_token_verification";

export interface GoogleOAuthFailureDetails {
  operation: GoogleOAuthOperation;
  networkCode?: string;
  responseStatus?: number;
}

export interface GoogleOAuthDiagnostics {
  providerUnavailable(details: GoogleOAuthFailureDetails): void;
}

interface GoogleOAuthSdkClient {
  generateAuthUrl(options: GenerateAuthUrlOpts): string;
  getToken(code: string): Promise<{ tokens: { id_token?: string | null } }>;
  verifyIdToken(options: {
    audience: string;
    idToken: string;
  }): Promise<{ getPayload(): TokenPayload | undefined }>;
}

const NETWORK_FAILURE_CODES = new Set([
  "EAI_AGAIN",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

const isObject = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === "object" && value !== null;

const getResponseStatus = (error: unknown) => {
  if (!isObject(error) || !isObject(error.response)) {
    return undefined;
  }

  return typeof error.response.status === "number"
    ? error.response.status
    : undefined;
};

const getNetworkCode = (error: unknown) => {
  if (!isObject(error) || typeof error.code !== "string") {
    return undefined;
  }

  return NETWORK_FAILURE_CODES.has(error.code) ? error.code : undefined;
};

const getAvailabilityFailure = (
  error: unknown,
  operation: GoogleOAuthOperation,
): GoogleOAuthFailureDetails | undefined => {
  const responseStatus = getResponseStatus(error);
  const networkCode = getNetworkCode(error);
  const unavailableStatus =
    responseStatus === 429 ||
    (responseStatus !== undefined && responseStatus >= 500);

  if (!unavailableStatus && !networkCode) {
    return undefined;
  }

  return {
    operation,
    ...(networkCode ? { networkCode } : {}),
    ...(responseStatus === undefined ? {} : { responseStatus }),
  };
};

const mapGoogleError = (
  error: unknown,
  operation: GoogleOAuthOperation,
  diagnostics: GoogleOAuthDiagnostics,
) => {
  const availabilityFailure = getAvailabilityFailure(error, operation);

  if (availabilityFailure) {
    diagnostics.providerUnavailable(availabilityFailure);
    return new GoogleProviderUnavailableError();
  }

  return new InvalidGoogleAuthenticationError({ cause: error });
};

const getAvatarUrl = (picture: string | undefined) => {
  if (!picture) {
    return undefined;
  }

  try {
    const url = new URL(picture);
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

const getDisplayName = (payload: TokenPayload, email: string) => {
  const name = payload.name?.trim();
  return (name || email.split("@")[0] || "Google User").slice(0, 50);
};

export const createGoogleOAuthClient = (
  config: GoogleOAuthConfig,
  sdkClient: GoogleOAuthSdkClient = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.callbackUrl,
  }),
  diagnostics: GoogleOAuthDiagnostics = { providerUnavailable: () => {} },
): GoogleOAuthClient => ({
  getAuthorizationUrl(state) {
    return sdkClient.generateAuthUrl({
      access_type: "online",
      prompt: "select_account",
      redirect_uri: config.callbackUrl,
      scope: ["openid", "email", "profile"],
      state,
    });
  },

  async exchangeCode(code) {
    let idToken: string;

    try {
      const { tokens } = await sdkClient.getToken(code);

      if (!tokens.id_token) {
        throw new InvalidGoogleAuthenticationError();
      }

      idToken = tokens.id_token;
    } catch (error) {
      if (error instanceof InvalidGoogleAuthenticationError) {
        throw error;
      }

      throw mapGoogleError(error, "code_exchange", diagnostics);
    }

    try {
      const ticket = await sdkClient.verifyIdToken({
        audience: config.clientId,
        idToken,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new InvalidGoogleAuthenticationError();
      }

      const email = payload.email.trim().toLowerCase();
      const avatarUrl = getAvatarUrl(payload.picture);

      return {
        providerAccountId: payload.sub,
        email,
        displayName: getDisplayName(payload, email),
        ...(avatarUrl ? { avatarUrl } : {}),
      };
    } catch (error) {
      if (error instanceof InvalidGoogleAuthenticationError) {
        throw error;
      }

      throw mapGoogleError(error, "id_token_verification", diagnostics);
    }
  },
});
