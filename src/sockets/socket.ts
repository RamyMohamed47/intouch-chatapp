import type { Logger } from "pino";

import type { InTouchSocketServer } from "../contracts/socket.js";
import type { AccessTokenManager } from "../modules/auth/auth.types.js";
import type { ConversationService } from "../modules/conversations/conversation.service.js";
import { getLogger } from "../config/logger.js";

const mongoIdPattern = /^[a-f\d]{24}$/i;

const isConversationInput = (
  input: unknown,
): input is { conversationId: string } =>
  typeof input === "object" &&
  input !== null &&
  "conversationId" in input &&
  typeof input.conversationId === "string" &&
  mongoIdPattern.test(input.conversationId);

const toSocketError = (error: unknown) => {
  if (
    error instanceof Error &&
    "isOperational" in error &&
    error.isOperational === true
  ) {
    return {
      code:
        "code" in error && typeof error.code === "string"
          ? error.code
          : "INTERNAL_SERVER_ERROR",
      message: error.message,
    };
  }
  return { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" };
};

const getAccessToken = (auth: unknown) => {
  if (typeof auth !== "object" || auth === null || !("accessToken" in auth)) {
    return null;
  }
  return typeof auth.accessToken === "string" ? auth.accessToken : null;
};

const configureSocket = (
  io: InTouchSocketServer,
  accessTokens: AccessTokenManager,
  conversations: Pick<ConversationService, "getAccessible">,
  logger: Logger = getLogger(),
) => {
  io.use((socket, next) => {
    const token = getAccessToken(socket.handshake.auth);
    if (!token) {
      next(new Error("Bearer access token is required"));
      return;
    }

    void accessTokens
      .verify(token)
      .then(({ userId }) => {
        socket.data.userId = userId;
        const expiresAt = accessTokens.getExpiration?.(token);
        if (expiresAt !== undefined && expiresAt !== null) {
          const timeout = Math.max(0, expiresAt * 1_000 - Date.now());
          const timer = setTimeout(() => socket.disconnect(true), timeout);
          timer.unref();
          socket.once("disconnect", () => clearTimeout(timer));
        }
        next();
      })
      .catch(() => next(new Error("Invalid or expired access token")));
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");

    socket.on("conversation:join", (input, acknowledge) => {
      if (typeof acknowledge !== "function") return;
      if (!isConversationInput(input)) {
        acknowledge({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid conversation ID",
          },
        });
        return;
      }
      void conversations
        .getAccessible(socket.data.userId, input.conversationId)
        .then(async () => {
          await socket.join(`conversation:${input.conversationId}`);
          acknowledge({ success: true });
        })
        .catch((error: unknown) => {
          acknowledge({ success: false, error: toSocketError(error) });
        });
    });

    socket.on("conversation:leave", (input, acknowledge) => {
      if (typeof acknowledge !== "function") return;
      if (!isConversationInput(input)) {
        acknowledge({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid conversation ID",
          },
        });
        return;
      }
      void Promise.resolve(
        socket.leave(`conversation:${input.conversationId}`),
      ).then(() => {
        acknowledge({ success: true });
      });
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });
};

export default configureSocket;
