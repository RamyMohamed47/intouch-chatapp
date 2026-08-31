import type { Logger } from "pino";
import {
  conversationSocketSchema,
  organizationSocketSchema,
  socketConnectionErrorSchema,
  socketHandshakeAuthSchema,
} from "@intouch/shared/realtime";
import { errorDtoSchema } from "@intouch/shared/common";

import type {
  InTouchSocketServer,
  SocketAcknowledgement,
} from "../contracts/socket.js";
import type { AccessTokenManager } from "../modules/auth/auth.types.js";
import {
  RateLimitAction,
  type AuthenticatedRateLimiter,
  type SocketConnectionGuard,
} from "../modules/abuse-protection/index.js";
import type { ConversationService } from "../modules/conversations/conversation.service.js";
import type { MembershipDirectoryService } from "../modules/memberships/membership-directory.service.js";
import type { PresenceService } from "../modules/presence/presence.service.js";
import type { TypingService } from "../modules/typing/typing.service.js";
import { getLogger } from "../config/logger.js";
import {
  organizationRoomName,
  roomName,
  userRoomName,
} from "../broadcasting/socketRealtimeGateway.js";
import { getObservabilityMetrics } from "../infrastructure/observability/observability.metrics.js";

export interface SocketDomainServices {
  connections?: SocketConnectionGuard;
  memberships?: Pick<MembershipDirectoryService, "assertMember">;
  presence?: Pick<PresenceService, "markOffline" | "markOnline"> &
    Partial<Pick<PresenceService, "refresh">>;
  rateLimits?: AuthenticatedRateLimiter;
  typing?: Pick<TypingService, "disconnect" | "start" | "stop">;
}

const createConnectionError = (
  code: string,
  message: string,
  retryAfterMs?: number,
) => {
  const error = new Error(message) as Error & { data?: unknown };
  error.data = socketConnectionErrorSchema.parse({
    code,
    message,
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
  });
  return error;
};

const toSocketError = (error: unknown) => {
  if (
    error instanceof Error &&
    "isOperational" in error &&
    error.isOperational === true
  ) {
    return errorDtoSchema.parse({
      code:
        "code" in error && typeof error.code === "string"
          ? error.code
          : "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }
  return errorDtoSchema.parse({
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
  });
};

const configureSocket = (
  io: InTouchSocketServer,
  accessTokens: AccessTokenManager,
  conversations: Pick<ConversationService, "getAccessible">,
  logger: Logger = getLogger(),
  services: SocketDomainServices = {},
) => {
  const metrics = getObservabilityMetrics();
  io.use((socket, next) => {
    const auth = socketHandshakeAuthSchema.safeParse(socket.handshake.auth);
    if (!auth.success) {
      metrics.recordRealtimeConnection("rejected");
      next(
        createConnectionError(
          "UNAUTHORIZED",
          "Bearer access token is required",
        ),
      );
      return;
    }

    void accessTokens
      .verify(auth.data.accessToken)
      .then(({ userId }) => {
        void (async () => {
          const admission = services.connections
            ? await services.connections.admit(userId, socket.id)
            : { allowed: true, retryAfterMs: 0 };
          if (!admission.allowed) {
            metrics.recordRealtimeConnection("rejected");
            next(
              createConnectionError(
                "TOO_MANY_REQUESTS",
                "Too many realtime connection attempts",
                admission.retryAfterMs,
              ),
            );
            return;
          }

          socket.data.userId = userId;
          if (services.connections) {
            socket.once("disconnect", () => {
              void services.connections
                ?.release(userId, socket.id)
                .catch((error: unknown) => {
                  logger.error(
                    { err: error, userId },
                    "Realtime connection release failed",
                  );
                });
            });
          }
          const expiresAt = accessTokens.getExpiration?.(auth.data.accessToken);
          if (expiresAt !== undefined && expiresAt !== null) {
            const timeout = Math.max(0, expiresAt * 1_000 - Date.now());
            const timer = setTimeout(() => socket.disconnect(true), timeout);
            timer.unref();
            socket.once("disconnect", () => clearTimeout(timer));
          }
          next();
        })().catch((error: unknown) => {
          metrics.recordRealtimeConnection("rejected");
          logger.error({ err: error, userId }, "Socket admission failed");
          const socketError = toSocketError(error);
          next(
            createConnectionError(
              socketError.code,
              socketError.message,
              socketError.code === "SERVICE_UNAVAILABLE" ? 5_000 : undefined,
            ),
          );
        });
      })
      .catch(() => {
        metrics.recordRealtimeConnection("rejected");
        next(
          createConnectionError(
            "UNAUTHORIZED",
            "Invalid or expired access token",
          ),
        );
      });
  });

  io.on("connection", (socket) => {
    metrics.recordRealtimeConnection("accepted");
    logger.debug({ socketId: socket.id }, "Socket connected");
    void socket.join(userRoomName(socket.data.userId));
    void services.presence
      ?.markOnline(socket.data.userId, socket.id)
      .catch((error: unknown) => {
        logger.error(
          { err: error, userId: socket.data.userId },
          "Presence update failed",
        );
      });

    const connectionHeartbeat = services.connections
      ? setInterval(() => {
          void services.connections
            ?.refresh?.(socket.data.userId, socket.id)
            .catch((error: unknown) => {
              logger.error(
                { err: error, userId: socket.data.userId },
                "Realtime connection heartbeat failed",
              );
            });
          void services.presence
            ?.refresh?.(socket.data.userId, socket.id)
            .catch((error: unknown) => {
              logger.error(
                { err: error, userId: socket.data.userId },
                "Presence heartbeat failed",
              );
            });
        }, 15_000)
      : undefined;
    connectionHeartbeat?.unref();
    socket.once("disconnect", () => {
      if (connectionHeartbeat) clearInterval(connectionHeartbeat);
    });

    const enforceEventLimit = (
      action: RateLimitAction,
      acknowledge: SocketAcknowledgement,
      proceed: () => void,
    ) => {
      if (!services.rateLimits) {
        metrics.recordRealtimeEvent(action, "accepted");
        proceed();
        return;
      }
      void services.rateLimits
        .consume(socket.data.userId, action)
        .then((decision) => {
          if (decision.allowed) {
            metrics.recordRealtimeEvent(action, "accepted");
            proceed();
            return;
          }
          metrics.recordRealtimeEvent(action, "rejected");
          acknowledge({
            success: false,
            error: {
              code: "TOO_MANY_REQUESTS",
              message: "Too many realtime requests",
            },
          });
        })
        .catch((error: unknown) => {
          metrics.recordRealtimeEvent(action, "rejected");
          logger.error(
            { action, err: error, userId: socket.data.userId },
            "Realtime rate limit failed",
          );
          acknowledge({
            success: false,
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "Something went wrong",
            },
          });
        });
    };

    socket.on("conversation:join", (input, acknowledge) => {
      if (typeof acknowledge !== "function") return;
      enforceEventLimit(RateLimitAction.SOCKET_SUBSCRIBE, acknowledge, () => {
        const parsed = conversationSocketSchema.safeParse(input);
        if (!parsed.success) {
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
          .getAccessible(socket.data.userId, parsed.data.conversationId)
          .then(async () => {
            await socket.join(roomName(parsed.data.conversationId));
            try {
              await conversations.getAccessible(
                socket.data.userId,
                parsed.data.conversationId,
              );
            } catch (error) {
              await socket.leave(roomName(parsed.data.conversationId));
              throw error;
            }
            acknowledge({ success: true });
          })
          .catch((error: unknown) => {
            acknowledge({ success: false, error: toSocketError(error) });
          });
      });
    });

    socket.on("conversation:leave", (input, acknowledge) => {
      if (typeof acknowledge !== "function") return;
      const parsed = conversationSocketSchema.safeParse(input);
      if (!parsed.success) {
        acknowledge({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid conversation ID",
          },
        });
        return;
      }
      void (async () => {
        await services.typing?.stop(
          parsed.data.conversationId,
          socket.data.userId,
          socket.id,
        );
        await socket.leave(roomName(parsed.data.conversationId));
        acknowledge({ success: true });
      })().catch((error: unknown) => {
        logger.error(
          { err: error, userId: socket.data.userId },
          "Conversation leave cleanup failed",
        );
        acknowledge({ success: false, error: toSocketError(error) });
      });
    });

    socket.on("organization:subscribe", (input, acknowledge) => {
      if (typeof acknowledge !== "function") return;
      enforceEventLimit(RateLimitAction.SOCKET_SUBSCRIBE, acknowledge, () => {
        const parsed = organizationSocketSchema.safeParse(input);
        if (!parsed.success) {
          acknowledge({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid organization ID",
            },
          });
          return;
        }
        if (!services.memberships) {
          acknowledge({
            success: false,
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "Something went wrong",
            },
          });
          return;
        }
        void services.memberships
          .assertMember(socket.data.userId, parsed.data.organizationId)
          .then(async () => {
            await socket.join(organizationRoomName(parsed.data.organizationId));
            acknowledge({ success: true });
          })
          .catch((error: unknown) => {
            acknowledge({ success: false, error: toSocketError(error) });
          });
      });
    });

    socket.on("organization:unsubscribe", (input, acknowledge) => {
      if (typeof acknowledge !== "function") return;
      const parsed = organizationSocketSchema.safeParse(input);
      if (!parsed.success) {
        acknowledge({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid organization ID",
          },
        });
        return;
      }
      void Promise.resolve(
        socket.leave(organizationRoomName(parsed.data.organizationId)),
      ).then(() => acknowledge({ success: true }));
    });

    const handleTyping = (
      isTyping: boolean,
      input: unknown,
      acknowledge: SocketAcknowledgement,
    ) => {
      if (typeof acknowledge !== "function") return;
      const proceed = () => {
        const parsed = conversationSocketSchema.safeParse(input);
        if (!parsed.success) {
          acknowledge({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid conversation ID",
            },
          });
          return;
        }
        if (!socket.rooms.has(roomName(parsed.data.conversationId))) {
          acknowledge({
            success: false,
            error: {
              code: "CONVERSATION_NOT_FOUND",
              message: "Join the conversation before sending typing events",
            },
          });
          return;
        }
        const update = isTyping
          ? services.typing?.start(
              parsed.data.conversationId,
              socket.data.userId,
              socket.id,
            )
          : services.typing?.stop(
              parsed.data.conversationId,
              socket.data.userId,
              socket.id,
            );
        void Promise.resolve(update)
          .then(() => acknowledge({ success: true }))
          .catch((error: unknown) => {
            logger.error(
              { err: error, userId: socket.data.userId },
              "Typing update failed",
            );
            acknowledge({ success: false, error: toSocketError(error) });
          });
      };
      if (isTyping) {
        enforceEventLimit(RateLimitAction.SOCKET_TYPING, acknowledge, proceed);
      } else {
        proceed();
      }
    };

    socket.on("typing:start", (input, acknowledge) => {
      handleTyping(true, input, acknowledge);
    });
    socket.on("typing:stop", (input, acknowledge) => {
      handleTyping(false, input, acknowledge);
    });

    socket.on("disconnect", () => {
      metrics.recordRealtimeConnection("closed");
      void services.typing?.disconnect(socket.id).catch((error: unknown) => {
        logger.error(
          { err: error, userId: socket.data.userId },
          "Typing disconnect cleanup failed",
        );
      });
      void services.presence
        ?.markOffline(socket.data.userId, socket.id)
        .catch((error: unknown) => {
          logger.error(
            { err: error, userId: socket.data.userId },
            "Presence update failed",
          );
        });
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });
};

export default configureSocket;
