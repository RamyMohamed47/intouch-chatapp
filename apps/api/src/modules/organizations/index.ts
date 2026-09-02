import type { RequestHandler } from "express";
import type { Logger } from "pino";

import type { MessageBroadcaster } from "../../broadcasting/messageBroadcaster.js";
import createAuthenticatedRateLimit from "../../middleware/authenticatedRateLimit.js";
import {
  createConversationActivityService,
  createMongooseConversationActivityAudienceRepository,
  type ConversationActivityRealtime,
} from "../conversation-activity/index.js";
import {
  RateLimitAction,
  type AuthenticatedRateLimiter,
} from "../abuse-protection/index.js";
import {
  createDirectMessageController,
  createDirectMessageRouter,
  createDirectMessageService,
} from "../direct-messages/index.js";
import {
  createChatWallpaperController,
  createChatWallpaperService,
  createConversationChatWallpaperRouter,
  createMongooseChatWallpaperRepository,
  createUserChatWallpaperRouter,
} from "../chat-wallpapers/index.js";
import {
  createCategoryController,
  createCategoryRouter,
  createCategoryService,
  createMongooseCategoryRepository,
} from "../categories/index.js";
import {
  createConversationController,
  createConversationPolicy,
  createConversationRouter,
  createConversationService,
  createMongooseConversationParticipantRepository,
  createMongooseConversationRepository,
  createOrganizationConversationRouter,
  type ConversationRealtime,
} from "../conversations/index.js";
import {
  createInvitationController,
  createInvitationRouter,
  createInvitationService,
  createMongooseInvitationRepository,
} from "../invitations/index.js";
import {
  createMembershipAccessService,
  createMembershipController,
  createMembershipDirectoryService,
  createMembershipService,
  createMongooseMembershipRepository,
  createOrganizationAccessRouter,
  type MembershipRealtime,
} from "../memberships/index.js";
import {
  createConversationMessageRouter,
  createMessageController,
  createMessageRouter,
  createMessageService,
  createMongooseConversationSummaryRepository,
  createMongooseMessageRepository,
} from "../message/index.js";
import {
  createMessageReactionController,
  createMessageReactionRouter,
  createMessageReactionService,
  createMongooseMessageReactionRepository,
  type MessageReactionRealtime,
} from "../message-reactions/index.js";
import {
  createMongooseNotificationRepository,
  createNotificationController,
  createNotificationRouter,
  createNotificationService,
  type NotificationRealtime,
} from "../notifications/index.js";
import {
  createMongooseConversationReadStateRepository,
  createReadReceiptController,
  createReadReceiptRouter,
  createReadReceiptService,
  type ReadReceiptRealtime,
} from "../read-receipts/index.js";
import {
  createPresenceService,
  type PresenceRealtime,
  type PresenceStore,
} from "../presence/index.js";
import { createMongooseUserRepository } from "../user/index.js";
import {
  createMongooseSearchRepository,
  createSearchController,
  createSearchRouter,
  createSearchService,
  type SearchProvider,
  type SearchServiceDependencies,
} from "../search/index.js";
import createOrganizationController from "./organization.controller.js";
import createOrganizationPolicy from "./organization.policy.js";
import createMongooseOrganizationRepository from "./organization.repository.js";
import createOrganizationRouter from "./organization.routes.js";
import createOrganizationService from "./organization.service.js";
import createMongooseOrganizationUnitOfWork from "./organization.unit-of-work.js";
import type { MailOutboxJobFactory } from "../mail/index.js";
import {
  createAssetRouter,
  createMongooseStoredAssetRepository,
  createMongooseUploadUnitOfWork,
  createUploadController,
  createUploadRouter,
  createUploadService,
  createUserAvatarRouter,
  type ObjectStorage,
} from "../uploads/index.js";
import {
  createCallRouter,
  createConversationVoiceRouter,
  createMongooseCallSessionRepository,
  createVoiceController,
  createVoiceService,
  createVoiceSessionRouter,
  createVoiceWebhookRouter,
  type VoiceCallJobs,
  type VoiceMediaProvider,
  type VoiceRealtime,
  type VoiceService,
  type VoiceSessionStore,
  type VoiceTelemetry,
} from "../voice/index.js";

type OrganizationTelemetry = NonNullable<
  SearchServiceDependencies["telemetry"]
> &
  VoiceTelemetry;

export interface OrganizationModuleDependencies {
  conversationActivityRealtime: ConversationActivityRealtime;
  conversationRealtime: ConversationRealtime;
  membershipRealtime: MembershipRealtime;
  messageBroadcaster: MessageBroadcaster;
  messageReactionRealtime: MessageReactionRealtime;
  notificationRealtime: NotificationRealtime;
  logger: Logger;
  presenceRealtime: PresenceRealtime;
  presenceStore?: PresenceStore;
  readReceiptRealtime: ReadReceiptRealtime;
  rateLimits: AuthenticatedRateLimiter;
  requireAccessToken: RequestHandler;
  searchProvider: SearchProvider;
  mail: MailOutboxJobFactory;
  storage: ObjectStorage;
  telemetry?: OrganizationTelemetry;
  uploadDailyUserBytes: number;
  organizationStorageBytes: number;
  voiceJobs: VoiceCallJobs;
  voiceMedia: VoiceMediaProvider;
  voiceRealtime: VoiceRealtime;
  voiceSessions: VoiceSessionStore;
}

const createOrganizationModule = ({
  conversationActivityRealtime,
  conversationRealtime,
  membershipRealtime,
  messageBroadcaster,
  messageReactionRealtime,
  notificationRealtime,
  logger,
  presenceRealtime,
  presenceStore,
  rateLimits,
  readReceiptRealtime,
  requireAccessToken,
  searchProvider,
  mail,
  storage,
  telemetry,
  uploadDailyUserBytes,
  organizationStorageBytes,
  voiceJobs,
  voiceMedia,
  voiceRealtime,
  voiceSessions,
}: OrganizationModuleDependencies) => {
  const createDirectMessageLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.DIRECT_MESSAGE_CREATE,
    "Too many direct message creation attempts",
  );
  const createMessageLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.MESSAGE_CREATE,
    "Too many message creation attempts",
  );
  const mutateMessageLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.MESSAGE_MUTATE,
    "Too many message mutation attempts",
  );
  const mutateMessageReactionLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.MESSAGE_REACTION,
    "Too many message reaction attempts",
  );
  const updateReadReceiptLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.READ_RECEIPT_UPDATE,
    "Too many read receipt updates",
  );
  const searchLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.SEARCH,
    "Too many search requests",
  );
  const createInvitationLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.INVITATION_CREATE,
    "Too many invitation attempts",
  );
  const mutateNotificationLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.NOTIFICATION_MUTATE,
    "Too many notification updates",
  );
  const mutateWallpaperLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.WALLPAPER_MUTATE,
    "Too many wallpaper updates",
  );
  const mutateUploadLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.UPLOAD_MUTATE,
    "Too many upload attempts",
  );
  const accessAssetLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.ASSET_ACCESS,
    "Too many asset access attempts",
  );
  const voiceJoinLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.VOICE_JOIN,
    "Too many voice session attempts",
  );
  const voiceLifecycleLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.VOICE_LIFECYCLE,
    "Too many call lifecycle requests",
  );
  const voiceModerateLimit = createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.VOICE_MODERATE,
    "Too many voice moderation requests",
  );
  const categories = createMongooseCategoryRepository();
  const chatWallpapers = createMongooseChatWallpaperRepository();
  const conversations = createMongooseConversationRepository();
  const conversationParticipants =
    createMongooseConversationParticipantRepository();
  const messages = createMongooseMessageRepository();
  const messageReactions = createMongooseMessageReactionRepository();
  const conversationReadStates =
    createMongooseConversationReadStateRepository();
  const conversationSummaries = createMongooseConversationSummaryRepository();
  const conversationActivity = createConversationActivityService({
    audiences: createMongooseConversationActivityAudienceRepository(),
    logger,
    realtime: conversationActivityRealtime,
  });
  const calls = createMongooseCallSessionRepository();
  const organizations = createMongooseOrganizationRepository();
  const notifications = createMongooseNotificationRepository();
  const invitations = createMongooseInvitationRepository();
  const memberships = createMembershipService(
    createMongooseMembershipRepository(),
  );
  const users = createMongooseUserRepository();
  const unitOfWork = createMongooseOrganizationUnitOfWork();
  const policy = createOrganizationPolicy();
  const conversationPolicy = createConversationPolicy();
  const notificationService = createNotificationService({
    logger,
    notifications,
    organizations,
    realtime: notificationRealtime,
    users,
  });
  const presenceService = createPresenceService({
    memberships,
    realtime: presenceRealtime,
    users,
    ...(presenceStore ? { store: presenceStore } : {}),
    onError: (error) => {
      logger.error({ err: error }, "Presence transition failed");
    },
  });
  const membershipDirectory = createMembershipDirectoryService({
    memberships,
    organizations,
    policy,
    presence: presenceService,
    users,
  });
  const searchService = createSearchService({
    conversations,
    logger,
    memberships,
    organizationPolicy: policy,
    organizations,
    participants: conversationParticipants,
    presence: presenceService,
    repository: createMongooseSearchRepository(searchProvider),
    ...(telemetry ? { telemetry } : {}),
    users,
  });
  const voiceServiceRef: { current?: VoiceService } = {};
  const service = createOrganizationService({
    organizations,
    memberships,
    unitOfWork,
    policy,
    realtime: conversationRealtime,
    notificationDelivery: notificationService,
    voiceLifecycle: {
      closeConversation: (conversationId) =>
        voiceServiceRef.current?.closeConversation(conversationId) ??
        Promise.resolve(),
    },
  });
  const controller = createOrganizationController(service);
  const categoryService = createCategoryService({
    categories,
    memberships,
    organizations,
    policy,
    unitOfWork,
  });
  const conversationService = createConversationService({
    categories,
    conversations,
    memberships,
    conversationSummaries,
    organizations,
    participants: conversationParticipants,
    policy: conversationPolicy,
    organizationPolicy: policy,
    realtime: conversationRealtime,
    unitOfWork,
    users,
    notificationDelivery: notificationService,
    voiceOccupancy: {
      list: (conversationIds) =>
        voiceServiceRef.current?.occupancy.list(conversationIds) ??
        Promise.resolve([]),
    },
    voiceLifecycle: {
      closeConversation: (conversationId, providerRoomId) =>
        voiceServiceRef.current?.closeConversation(
          conversationId,
          providerRoomId,
        ) ?? Promise.resolve(),
      retainOnlyUser: (conversationId, retainedUserId, actorUserId) =>
        voiceServiceRef.current?.retainOnlyUser(
          conversationId,
          retainedUserId,
          actorUserId,
        ) ?? Promise.resolve(),
      revokeUser: (conversationId, participantUserId, actorUserId) =>
        voiceServiceRef.current?.revokeUser(
          conversationId,
          participantUserId,
          actorUserId,
        ) ?? Promise.resolve(),
    },
  });
  const voiceService = createVoiceService({
    activity: conversationActivity,
    audiences: createMongooseConversationActivityAudienceRepository(),
    broadcaster: messageBroadcaster,
    calls,
    conversationPolicy,
    conversations: conversationService,
    jobs: voiceJobs,
    logger,
    media: voiceMedia,
    memberships,
    participants: conversationParticipants,
    realtime: voiceRealtime,
    sessions: voiceSessions,
    ...(telemetry ? { telemetry } : {}),
    unitOfWork,
  });
  voiceServiceRef.current = voiceService;
  const assets = createMongooseStoredAssetRepository();
  const uploadService = createUploadService({
    assets,
    conversations: conversationService,
    storage,
    unitOfWork: createMongooseUploadUnitOfWork(),
    dailyUserBytes: uploadDailyUserBytes,
    organizationStorageBytes,
  });
  const chatWallpaperService = createChatWallpaperService({
    conversations,
    memberships,
    participants: conversationParticipants,
    policy: conversationPolicy,
    preferences: chatWallpapers,
    unitOfWork,
  });
  const messageReactionService = createMessageReactionService({
    conversations: conversationService,
    logger,
    memberships,
    messages,
    participants: conversationParticipants,
    reactions: messageReactions,
    realtime: messageReactionRealtime,
    notificationDelivery: notificationService,
    unitOfWork,
    users,
  });
  const messageService = createMessageService({
    activity: conversationActivity,
    broadcaster: messageBroadcaster,
    conversationPolicy,
    conversations: conversationService,
    calls: voiceService,
    messages,
    notificationDelivery: notificationService,
    reactions: messageReactionService,
    uploads: uploadService,
    unitOfWork,
  });
  const directMessageService = createDirectMessageService({
    activity: conversationActivity,
    conversations,
    memberships,
    organizations,
    organizationPolicy: policy,
    summaries: conversationService,
    unitOfWork,
  });
  const readReceiptService = createReadReceiptService({
    conversations: conversationService,
    messages,
    readStates: conversationReadStates,
    notificationDelivery: notificationService,
    unitOfWork,
    realtime: readReceiptRealtime,
  });
  const categoryController = createCategoryController(categoryService);
  const conversationController =
    createConversationController(conversationService);
  const chatWallpaperController =
    createChatWallpaperController(chatWallpaperService);
  const messageController = createMessageController(messageService);
  const messageReactionController = createMessageReactionController(
    messageReactionService,
  );
  const directMessageController =
    createDirectMessageController(directMessageService);
  const readReceiptController = createReadReceiptController(readReceiptService);
  const invitationService = createInvitationService({
    invitations,
    realtime: membershipRealtime,
    organizations,
    policy,
    unitOfWork,
    users,
    mail,
    notificationDelivery: notificationService,
  });
  const membershipAccessService = createMembershipAccessService({
    notificationDelivery: notificationService,
    policy,
    realtime: membershipRealtime,
    unitOfWork,
  });
  const invitationController = createInvitationController(invitationService);
  const membershipController = createMembershipController(
    membershipAccessService,
    membershipDirectory,
  );
  const searchController = createSearchController(searchService);
  const notificationController =
    createNotificationController(notificationService);
  const uploadController = createUploadController(uploadService);
  const voiceController = createVoiceController(voiceService);
  const router = createOrganizationRouter(controller, requireAccessToken);
  const accessRouter = createOrganizationAccessRouter(
    membershipController,
    invitationController,
    requireAccessToken,
    createInvitationLimit,
  );
  const invitationRouter = createInvitationRouter(
    invitationController,
    requireAccessToken,
  );
  const categoryRouter = createCategoryRouter(
    categoryController,
    requireAccessToken,
  );
  const organizationConversationRouter = createOrganizationConversationRouter(
    conversationController,
    requireAccessToken,
  );
  const conversationRouter = createConversationRouter(
    conversationController,
    requireAccessToken,
  );
  const conversationChatWallpaperRouter = createConversationChatWallpaperRouter(
    chatWallpaperController,
    requireAccessToken,
    mutateWallpaperLimit,
  );
  const userChatWallpaperRouter = createUserChatWallpaperRouter(
    chatWallpaperController,
    requireAccessToken,
    mutateWallpaperLimit,
  );
  const directMessageRouter = createDirectMessageRouter(
    directMessageController,
    requireAccessToken,
    createDirectMessageLimit,
  );
  const readReceiptRouter = createReadReceiptRouter(
    readReceiptController,
    requireAccessToken,
    updateReadReceiptLimit,
  );
  const conversationMessageRouter = createConversationMessageRouter(
    messageController,
    requireAccessToken,
    createMessageLimit,
  );
  const messageRouter = createMessageRouter(
    messageController,
    requireAccessToken,
    mutateMessageLimit,
  );
  const messageReactionRouter = createMessageReactionRouter(
    messageReactionController,
    requireAccessToken,
    mutateMessageReactionLimit,
  );
  const searchRouter = createSearchRouter(
    searchController,
    requireAccessToken,
    searchLimit,
  );
  const notificationRouter = createNotificationRouter(
    notificationController,
    requireAccessToken,
    mutateNotificationLimit,
  );
  const uploadRouter = createUploadRouter(
    uploadController,
    requireAccessToken,
    mutateUploadLimit,
  );
  const assetRouter = createAssetRouter(
    uploadController,
    requireAccessToken,
    accessAssetLimit,
  );
  const userAvatarRouter = createUserAvatarRouter(
    uploadController,
    requireAccessToken,
    mutateUploadLimit,
  );
  const conversationVoiceRouter = createConversationVoiceRouter(
    voiceController,
    requireAccessToken,
    voiceJoinLimit,
    voiceModerateLimit,
  );
  const voiceSessionRouter = createVoiceSessionRouter(
    voiceController,
    requireAccessToken,
    voiceJoinLimit,
  );
  const callRouter = createCallRouter(
    voiceController,
    requireAccessToken,
    voiceLifecycleLimit,
  );
  const voiceWebhookRouter = createVoiceWebhookRouter(voiceController);

  return {
    accessRouter,
    assetRouter,
    assets,
    categoryRouter,
    callRouter,
    conversationMessageRouter,
    conversationChatWallpaperRouter,
    conversationRouter,
    conversationVoiceRouter,
    conversationService,
    directMessageRouter,
    invitationRouter,
    messageRouter,
    messageReactionRouter,
    notificationRouter,
    membershipDirectory,
    organizationConversationRouter,
    presenceService,
    readReceiptRouter,
    router,
    searchRouter,
    userChatWallpaperRouter,
    uploadRouter,
    userAvatarRouter,
    voiceService,
    voiceSessionRouter,
    voiceWebhookRouter,
  };
};

export default createOrganizationModule;
export { default as createOrganizationController } from "./organization.controller.js";
export { default as createMongooseOrganizationRepository } from "./organization.repository.js";
export { default as createOrganizationRouter } from "./organization.routes.js";
export { default as createOrganizationService } from "./organization.service.js";
export { default as createMongooseOrganizationUnitOfWork } from "./organization.unit-of-work.js";
export { default as createOrganizationPolicy } from "./organization.policy.js";
export type { OrganizationController } from "./organization.controller.js";
export type { OrganizationRepository } from "./organization.repository.js";
export type { OrganizationService } from "./organization.service.js";
export type { OrganizationUnitOfWork } from "./organization.unit-of-work.js";
export type { OrganizationPolicy } from "./organization.policy.js";
