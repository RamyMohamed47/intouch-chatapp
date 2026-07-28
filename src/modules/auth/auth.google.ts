import {
  OAuth2Client,
  type GenerateAuthUrlOpts,
  type TokenPayload,
} from "google-auth-library";

import { InvalidGoogleAuthenticationError } from "./auth.errors.js";
import type { GoogleOAuthClient } from "./auth.types.js";

export interface GoogleOAuthConfig {
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
}

interface GoogleOAuthSdkClient {
  generateAuthUrl(options: GenerateAuthUrlOpts): string;
  getToken(code: string): Promise<{ tokens: { id_token?: string | null } }>;
  verifyIdToken(options: {
    audience: string;
    idToken: string;
  }): Promise<{ getPayload(): TokenPayload | undefined }>;
}

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
    try {
      const { tokens } = await sdkClient.getToken(code);

      if (!tokens.id_token) {
        throw new InvalidGoogleAuthenticationError();
      }

      const ticket = await sdkClient.verifyIdToken({
        audience: config.clientId,
        idToken: tokens.id_token,
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

      throw new InvalidGoogleAuthenticationError({ cause: error });
    }
  },
});
