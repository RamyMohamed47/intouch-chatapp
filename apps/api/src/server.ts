import http from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import createApp from "./app.js";
import createSocketRealtimeGateway from "./broadcasting/socketRealtimeGateway.js";
import { loadConfig } from "./config/env.js";
import connectDatabase, {
  disconnectDatabase,
  isDatabaseReady,
} from "./config/database.js";
import { getLogger } from "./config/logger.js";
import { createApiDocsRouter } from "./docs/api-docs.router.js";
import { loadOpenApiContract } from "./docs/openapi.contract.js";
import {
  createBullMqBackgroundJobsRuntime,
  createPollingBackgroundJobsRuntime,
  type BackgroundJobComponent,
  type BackgroundJobsRuntime,
} from "./infrastructure/background-jobs/index.js";
import {
  createRedisAuthRateLimitStoreFactory,
  createRedisRuntime,
} from "./infrastructure/redis/index.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./contracts/socket.js";
import createAuthModule from "./modules/auth/index.js";
import createAbuseProtectionModule, {
  createRedisRateLimitStore,
  createRedisSocketConnectionStore,
  RateLimitAction,
} from "./modules/abuse-protection/index.js";
import createAuthenticatedRateLimit from "./middleware/authenticatedRateLimit.js";
import createOrganizationModule from "./modules/organizations/index.js";
import { createMongooseNotificationRepository } from "./modules/notifications/index.js";
import createAiModule, { createRedisAiQuotaStore } from "./modules/ai/index.js";
import configureSocket from "./sockets/socket.js";
import {
  createRedisTypingStore,
  createTypingExpiryWorker,
  createTypingService,
} from "./modules/typing/index.js";
import {
  createPresenceExpiryWorker,
  createRedisPresenceStore,
} from "./modules/presence/index.js";
import {
  createBullMqMailJobs,
  createMailOutboxJobFactory,
  createMailOutboxWorker,
  createMailPayloadCipher,
  createMailRenderer,
  createMongooseMailOutboxRepository,
  createBrevoMailTransport,
  createSmtpMailTransport,
} from "./modules/mail/index.js";
import {
  createAssetCleanupWorker,
  createBullMqAssetCleanupJobs,
  createDisabledObjectStorage,
  createR2ObjectStorage,
} from "./modules/uploads/index.js";
import {
  captureUnexpectedError,
  getObservabilityMetrics,
  instrumentMailTransport,
  instrumentObjectStorage,
  instrumentVoiceMediaProvider,
  shutdownObservability,
} from "./infrastructure/observability/index.js";
import {
  createBullMqVoiceCallJobs,
  createDisabledVoiceMediaProvider,
  createInMemoryVoiceCallJobs,
  createInMemoryVoiceSessionStore,
  createLiveKitVoiceMediaProvider,
  createRedisVoiceSessionStore,
} from "./modules/voice/index.js";
import {
  createBullMqPushJobs,
  createExpoPushProvider,
  createMongoosePushDeviceRepository,
  createMongoosePushOutboxRepository,
  createPushDeviceController,
  createPushDeviceRouter,
  createPushDeviceService,
  createPushPublisher,
  createPushTokenCipher,
  createPushWorker,
} from "./modules/push/index.js";

const logger = getLogger();
type InTouchServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const resources: {
  closeAbuseProtection?: () => void;
  closeAi?: () => void;
  closeBackgroundJobs?: () => Promise<void>;
  closePresence?: () => void;
  closeTyping?: () => void;
  closeRuntimeState?: () => Promise<void>;
  server?: http.Server;
  io?: InTouchServer;
} = {};
let shutdownPromise: Promise<void> | undefined;

const closeSocketServer = async () => {
  const socketServer = resources.io;

  if (!socketServer) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    void socketServer.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const closeHttpServer = async () => {
  const httpServer = resources.server;

  if (!httpServer?.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      const isNotRunningError =
        error !== undefined &&
        "code" in error &&
        error.code === "ERR_SERVER_NOT_RUNNING";

      if (error && !isNotRunningError) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const shutdown = (
  reason: string,
  exitCode: number,
  error?: unknown,
): Promise<void> => {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    if (error === undefined) {
      logger.info({ reason }, "Graceful shutdown started");
    } else {
      logger.fatal({ err: error, reason }, "Fatal process error");
      captureUnexpectedError(error, { phase: "process", reason });
    }

    const forceShutdownTimer = setTimeout(() => {
      logger.fatal({ reason }, "Graceful shutdown timed out");
      resources.server?.closeAllConnections();
      process.exit(1);
    }, 30_000);
    forceShutdownTimer.unref();

    try {
      await closeSocketServer();
      await closeHttpServer();
      resources.closeAbuseProtection?.();
      resources.closeAi?.();
      await resources.closeBackgroundJobs?.();
      resources.closePresence?.();
      resources.closeTyping?.();
      await resources.closeRuntimeState?.();
      await disconnectDatabase(logger);
      clearTimeout(forceShutdownTimer);
      logger.info({ reason }, "Graceful shutdown complete");
      await shutdownObservability();
      process.exit(exitCode);
    } catch (shutdownError) {
      clearTimeout(forceShutdownTimer);
      logger.fatal({ err: shutdownError, reason }, "Graceful shutdown failed");
      captureUnexpectedError(shutdownError, { phase: "shutdown", reason });
      await shutdownObservability();
      resources.server?.closeAllConnections();
      process.exit(1);
    }
  })();

  return shutdownPromise;
};

process.once("uncaughtException", (error) => {
  void shutdown("uncaughtException", 1, error);
});

process.once("unhandledRejection", (reason) => {
  void shutdown("unhandledRejection", 1, reason);
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM", 0);
});

process.once("SIGINT", () => {
  void shutdown("SIGINT", 0);
});

const config = loadConfig();
const runtimeState = createRedisRuntime(config.runtimeState, logger);
resources.closeRuntimeState = () => runtimeState.close();

try {
  await runtimeState.connect();
} catch (err) {
  await shutdown("Runtime state connection failed", 1, err);
}

const mailCipher = createMailPayloadCipher(config.mailOutboxEncryptionSecret);
const mailJobs = createMailOutboxJobFactory(mailCipher);
const rawMailTransport =
  config.mailTransport.provider === "brevo"
    ? createBrevoMailTransport({
        apiKey: config.mailTransport.apiKey,
        fromName: config.mailFromName,
        fromAddress: config.mailFromAddress,
      })
    : createSmtpMailTransport({
        host: config.mailTransport.host,
        port: config.mailTransport.port,
        secure: config.mailTransport.secure,
        requireTls: config.mailTransport.requireTls,
        user: config.mailTransport.user,
        password: config.mailTransport.password,
        fromName: config.mailFromName,
        fromAddress: config.mailFromAddress,
      });
const mailTransport = instrumentMailTransport(
  rawMailTransport,
  config.mailTransport.provider,
);
const mailWorker = createMailOutboxWorker({
  cipher: mailCipher,
  logger,
  outbox: createMongooseMailOutboxRepository(),
  render: createMailRenderer(config.webAppUrl, config.mobileAppUrl),
  transport: mailTransport,
});
const apiDocsRouter = createApiDocsRouter(loadOpenApiContract());
const abuseProtection = createAbuseProtectionModule(logger, {
  ...(runtimeState.command
    ? {
        rateLimitStore: createRedisRateLimitStore(
          runtimeState.command,
          runtimeState.keyPrefix,
        ),
        socketConnectionStore: createRedisSocketConnectionStore(
          runtimeState.command,
          runtimeState.keyPrefix,
        ),
      }
    : {}),
});
resources.closeAbuseProtection = abuseProtection.close;
const realtimeGateway = createSocketRealtimeGateway();
const typingStore = runtimeState.command
  ? createRedisTypingStore(runtimeState.command, runtimeState.keyPrefix)
  : undefined;
const typingService = createTypingService({
  realtime: realtimeGateway,
  ...(typingStore ? { store: typingStore, scheduleExpirations: false } : {}),
  onError: (error) => {
    logger.error({ err: error }, "Typing expiry failed");
  },
});
const typingExpiryWorker = typingStore
  ? createTypingExpiryWorker(typingStore, typingService, logger)
  : undefined;
resources.closeTyping = () => typingExpiryWorker?.close();
realtimeGateway.setTypingService(typingService);
const rawStorage =
  config.storage.provider === "r2"
    ? createR2ObjectStorage(config.storage)
    : createDisabledObjectStorage();
const storage = instrumentObjectStorage(rawStorage, config.storage.provider);
const observabilityMetrics = getObservabilityMetrics();
const voiceMedia = instrumentVoiceMediaProvider(
  config.voice.provider === "livekit"
    ? createLiveKitVoiceMediaProvider(config.voice)
    : createDisabledVoiceMediaProvider(),
  config.voice.provider,
);
const voiceSessions = runtimeState.command
  ? createRedisVoiceSessionStore(runtimeState.command, runtimeState.keyPrefix)
  : createInMemoryVoiceSessionStore();
observabilityMetrics.registerVoiceState(async () => {
  const sessions = (await voiceSessions.listReserved()).filter(
    ({ connectedAt }) => connectedAt !== null,
  );
  const channelSessions = sessions.filter(
    ({ kind }) => kind === "VOICE_CHANNEL",
  );
  return {
    activeCalls: sessions.length - channelSessions.length,
    channelParticipants: channelSessions.length,
    occupiedChannels: new Set(
      channelSessions.map(({ conversationId }) => conversationId),
    ).size,
  };
});
const voiceJobs =
  config.backgroundJobsProvider === "bullmq" &&
  config.runtimeState.provider === "redis"
    ? createBullMqVoiceCallJobs({
        logger,
        redisKeyPrefix: config.runtimeState.keyPrefix,
        redisUrl: config.runtimeState.url,
        telemetry: observabilityMetrics,
      })
    : createInMemoryVoiceCallJobs();
const presenceStore = runtimeState.command
  ? createRedisPresenceStore(runtimeState.command, runtimeState.keyPrefix)
  : undefined;
const pushRemovalRef: {
  current?: { remove(userId: string, installationId: string): Promise<void> };
} = {};
const auth = createAuthModule({
  actionTokenSecret: config.authActionTokenSecret,
  accessTokenSecret: config.accessTokenSecret,
  accessTokenIssuer: config.accessTokenIssuer,
  accessTokenAudience: config.accessTokenAudience,
  allowedOrigins: config.clientOrigins,
  cookie: {
    name: config.cookieName,
    secure: config.cookieSecure,
    maxAgeMs: 30 * 24 * 60 * 60 * 1000,
  },
  googleOAuth: {
    callbackUrl: config.googleOAuthCallbackUrl,
    clientId: config.googleOAuthClientId,
    clientSecret: config.googleOAuthClientSecret,
    frontendRedirectUrl: config.googleOAuthFrontendRedirectUrl,
    stateCookie: {
      name: config.googleOAuthStateCookieName,
      secure: config.cookieSecure,
      maxAgeMs: 10 * 60 * 1000,
    },
  },
  loginProtection: {
    attemptLimit: config.loginAttemptLimit,
    cooldownMs: config.loginAttemptCooldownMs,
    hashSecret: config.loginThrottleSecret,
    windowMs: config.loginAttemptWindowMs,
  },
  mail: mailJobs,
  removePushInstallation: (userId, installationId) =>
    pushRemovalRef.current?.remove(userId, installationId) ?? Promise.resolve(),
  ...(runtimeState.command
    ? {
        rateLimitStoreFactory: createRedisAuthRateLimitStoreFactory(
          runtimeState.command,
          runtimeState.keyPrefix,
        ),
      }
    : {}),
});
const pushRuntime =
  config.push.provider === "expo"
    ? (() => {
        const cipher = createPushTokenCipher(config.push.tokenEncryptionSecret);
        const devices = createMongoosePushDeviceRepository();
        const outbox = createMongoosePushOutboxRepository();
        const notificationRepository = createMongooseNotificationRepository();
        const publisher = createPushPublisher(outbox, notificationRepository);
        const deviceService = createPushDeviceService({ cipher, devices });
        pushRemovalRef.current = deviceService;
        const deviceController = createPushDeviceController(deviceService);
        const deviceLimit = createAuthenticatedRateLimit(
          abuseProtection.rateLimits,
          RateLimitAction.PUSH_DEVICE_MUTATE,
          "Too many push-device updates",
        );
        return {
          cipher,
          devices,
          outbox,
          notificationRepository,
          publisher,
          provider: createExpoPushProvider(config.push.accessToken),
          router: createPushDeviceRouter(
            deviceController,
            auth.requireAccessToken,
            deviceLimit,
          ),
        };
      })()
    : undefined;
const organizations = createOrganizationModule({
  conversationActivityRealtime: realtimeGateway,
  conversationRealtime: realtimeGateway,
  membershipRealtime: realtimeGateway,
  messageBroadcaster: realtimeGateway,
  messageReactionRealtime: realtimeGateway,
  notificationRealtime: realtimeGateway,
  ...(pushRuntime ? { pushPublisher: pushRuntime.publisher } : {}),
  logger,
  presenceRealtime: realtimeGateway,
  ...(presenceStore ? { presenceStore } : {}),
  rateLimits: abuseProtection.rateLimits,
  readReceiptRealtime: realtimeGateway,
  requireAccessToken: auth.requireAccessToken,
  searchProvider: config.searchProvider,
  mail: mailJobs,
  storage,
  telemetry: observabilityMetrics,
  uploadDailyUserBytes: config.uploadDailyUserBytes,
  organizationStorageBytes: config.organizationStorageBytes,
  voiceJobs,
  voiceMedia,
  voiceRealtime: realtimeGateway,
  voiceSessions,
});
const aiQuota = runtimeState.command
  ? createRedisAiQuotaStore(runtimeState.command, runtimeState.keyPrefix, {
      dailyUserRequests: config.ai.dailyUserRequests,
      dailyOrganizationRequests: config.ai.dailyOrganizationRequests,
      maxConcurrentRequests: config.ai.maxConcurrentRequests,
    })
  : undefined;
const ai = createAiModule({
  accessScope: organizations.conversationAccessScope,
  config: config.ai,
  logger,
  ...(aiQuota ? { quota: aiQuota } : {}),
  rateLimits: abuseProtection.rateLimits,
  requireAccessToken: auth.requireAccessToken,
  searchProvider: config.searchProvider,
  telemetry: observabilityMetrics,
});
resources.closeAi = ai.close;
const assetCleanupWorker = createAssetCleanupWorker({
  assets: organizations.assets,
  storage,
  logger,
});
const pushWorker = pushRuntime
  ? createPushWorker({
      cipher: pushRuntime.cipher,
      devices: pushRuntime.devices,
      logger,
      notifications: organizations.notificationService,
      notificationRepository: pushRuntime.notificationRepository,
      outbox: pushRuntime.outbox,
      provider: pushRuntime.provider,
    })
  : undefined;
let backgroundJobs: BackgroundJobsRuntime;
if (config.backgroundJobsProvider === "bullmq") {
  if (config.runtimeState.provider !== "redis") {
    throw new Error("BullMQ background jobs require Redis runtime state");
  }
  const mailJobsComponent = createBullMqMailJobs({
    cipher: mailCipher,
    logger,
    outbox: createMongooseMailOutboxRepository(),
    redisKeyPrefix: config.runtimeState.keyPrefix,
    redisUrl: config.runtimeState.url,
    render: createMailRenderer(config.webAppUrl, config.mobileAppUrl),
    transport: mailTransport,
    telemetry: observabilityMetrics,
  });
  const closeMailComponent: BackgroundJobComponent = {
    isReady: () => mailJobsComponent.isReady(),
    start: () => mailJobsComponent.start(),
    async close() {
      await mailJobsComponent.close();
      await mailTransport.close();
    },
  };
  backgroundJobs = createBullMqBackgroundJobsRuntime(
    [
      closeMailComponent,
      createBullMqAssetCleanupJobs({
        assets: organizations.assets,
        storage,
        logger,
        redisKeyPrefix: config.runtimeState.keyPrefix,
        redisUrl: config.runtimeState.url,
        telemetry: observabilityMetrics,
      }),
      voiceJobs,
      ...(pushRuntime
        ? [
            createBullMqPushJobs({
              cipher: pushRuntime.cipher,
              devices: pushRuntime.devices,
              logger,
              notifications: organizations.notificationService,
              notificationRepository: pushRuntime.notificationRepository,
              outbox: pushRuntime.outbox,
              provider: pushRuntime.provider,
              redisKeyPrefix: config.runtimeState.keyPrefix,
              redisUrl: config.runtimeState.url,
              telemetry: observabilityMetrics,
            }),
          ]
        : []),
    ],
    logger,
  );
} else {
  backgroundJobs = createPollingBackgroundJobsRuntime([
    mailWorker,
    assetCleanupWorker,
    voiceJobs,
    ...(pushWorker ? [pushWorker] : []),
  ]);
}
resources.closeBackgroundJobs = () => backgroundJobs.close();
observabilityMetrics.registerReadiness("mongodb", isDatabaseReady);
observabilityMetrics.registerReadiness("redis", () => runtimeState.isReady());
observabilityMetrics.registerReadiness("background_jobs", () =>
  backgroundJobs.isReady(),
);
const presenceExpiryWorker = presenceStore
  ? createPresenceExpiryWorker(
      presenceStore,
      organizations.presenceService,
      logger,
    )
  : undefined;
resources.closePresence = () => presenceExpiryWorker?.close();
const app = createApp({
  aiRouter: ai.router,
  allowedOrigins: config.clientOrigins,
  apiDocsRouter,
  assetRouter: organizations.assetRouter,
  authRouter: auth.router,
  categoryRouter: organizations.categoryRouter,
  callRouter: organizations.callRouter,
  conversationMessageRouter: organizations.conversationMessageRouter,
  conversationChatWallpaperRouter:
    organizations.conversationChatWallpaperRouter,
  conversationRouter: organizations.conversationRouter,
  conversationVoiceRouter: organizations.conversationVoiceRouter,
  directMessageRouter: organizations.directMessageRouter,
  invitationRouter: organizations.invitationRouter,
  messageRouter: organizations.messageRouter,
  messageReactionRouter: organizations.messageReactionRouter,
  notificationRouter: organizations.notificationRouter,
  ...(pushRuntime ? { pushDeviceRouter: pushRuntime.router } : {}),
  organizationAccessRouter: organizations.accessRouter,
  organizationConversationRouter: organizations.organizationConversationRouter,
  organizationRouter: organizations.router,
  readReceiptRouter: organizations.readReceiptRouter,
  searchRouter: organizations.searchRouter,
  userChatWallpaperRouter: organizations.userChatWallpaperRouter,
  uploadRouter: organizations.uploadRouter,
  userAvatarRouter: organizations.userAvatarRouter,
  voiceSessionRouter: organizations.voiceSessionRouter,
  voiceWebhookRouter: organizations.voiceWebhookRouter,
  trustProxy: config.trustProxy,
  readiness: {
    isReady: () =>
      isDatabaseReady() && runtimeState.isReady() && backgroundJobs.isReady(),
  },
});
const server = http.createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    credentials: true,
    origin: [...config.clientOrigins],
  },
  maxHttpBufferSize: 10 * 1024,
});
resources.server = server;
resources.io = io;

if (runtimeState.publisher && runtimeState.subscriber) {
  io.adapter(
    createAdapter(runtimeState.publisher, runtimeState.subscriber, {
      key: `${runtimeState.keyPrefix}:socket.io`,
      publishOnSpecificResponseChannel: true,
    }),
  );
}

realtimeGateway.setSocketServer(io);
configureSocket(
  io,
  auth.accessTokens,
  organizations.conversationService,
  logger,
  {
    connections: abuseProtection.socketConnections,
    memberships: organizations.membershipDirectory,
    presence: organizations.presenceService,
    rateLimits: abuseProtection.rateLimits,
    typing: typingService,
    voice: organizations.voiceService,
  },
);

try {
  await connectDatabase(config.databaseUri, logger);
  await backgroundJobs.start();
  presenceExpiryWorker?.start();
  typingExpiryWorker?.start();

  server.listen(config.port, () => {
    logger.info({ port: config.port }, "Server running");
  });
} catch (err) {
  await shutdown("Infrastructure connection failed", 1, err);
}
