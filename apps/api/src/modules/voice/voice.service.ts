import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { ChannelKind, ConversationType } from "@intouch/shared/conversations";
import {
  CallEndReason,
  CallStatus,
  VoiceSessionKind,
  voiceCredentialsDtoSchema,
  voiceSessionDtoSchema,
  type JoinVoiceSessionInput,
  type VoiceOccupancyDto,
} from "@intouch/shared/voice";
import type { Logger } from "pino";

import type { MessageBroadcaster } from "../../broadcasting/messageBroadcaster.js";
import type { ConversationActivityService } from "../conversation-activity/index.js";
import type { ConversationActivityAudienceRepository } from "../conversation-activity/conversation-activity.repository.js";
import type { ConversationParticipantRepository } from "../conversations/conversation-participant.repository.js";
import {
  ConversationConflictError,
  ConversationNotFoundError,
} from "../conversations/conversation.errors.js";
import type { ConversationPolicy } from "../conversations/conversation.policy.js";
import type { ConversationService } from "../conversations/conversation.service.js";
import type { ConversationRecord } from "../conversations/conversation.types.js";
import { isChannelConversation } from "../conversations/conversation.types.js";
import type { MembershipService } from "../memberships/index.js";
import type { MessageRecord } from "../message/message.types.js";
import { MessageType } from "../message/message.types.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import type { CallSessionRepository } from "./call.repository.js";
import {
  CallConflictError,
  CallForbiddenError,
  CallNotFoundError,
  VoiceCapacityError,
  VoiceSessionActiveError,
  VoiceUnavailableError,
  VoiceUserBusyError,
} from "./voice.errors.js";
import { VoiceCallJobKind, type VoiceCallJobs } from "./voice-call.jobs.js";
import type { VoiceMediaProvider } from "./voice-media.provider.js";
import type { VoiceRealtime } from "./voice.realtime.js";
import type { VoiceSessionStore } from "./voice-session.store.js";
import { toCallDto, toCallSummaryDto } from "./voice.mapper.js";
import type { CallSessionRecord, VoiceSessionRecord } from "./voice.types.js";

const VOICE_CAPACITY = 10 as const;
const RING_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 15_000;
const DISCONNECT_TIMEOUT_MS = 10_000;

const sessionDto = (session: VoiceSessionRecord) =>
  voiceSessionDtoSchema.parse({
    id: session.id,
    kind: session.kind,
    organizationId: session.organizationId,
    conversationId: session.conversationId,
    callId: session.callId,
    userId: session.userId,
    connectedAt: session.connectedAt,
  });

export interface VoiceTelemetry {
  recordVoiceCall(input: { event: "ended" | "started"; outcome: string }): void;
  recordVoiceJoin(input: {
    durationSeconds: number;
    kind: "call" | "voice_channel";
    result: "failure" | "success";
  }): void;
}

export interface VoiceServiceDependencies {
  activity: Pick<ConversationActivityService, "messageCreated">;
  audiences: ConversationActivityAudienceRepository;
  broadcaster: MessageBroadcaster;
  calls: CallSessionRepository;
  conversationPolicy: Pick<ConversationPolicy, "assertOwner">;
  conversations: Pick<
    ConversationService,
    "getAccessible" | "getAccessibleInContext"
  >;
  jobs: VoiceCallJobs;
  logger: Pick<Logger, "error" | "warn">;
  media: VoiceMediaProvider;
  memberships: MembershipService;
  participants: ConversationParticipantRepository;
  realtime: VoiceRealtime;
  sessions: VoiceSessionStore;
  telemetry?: VoiceTelemetry;
  unitOfWork: OrganizationUnitOfWork;
}

const createVoiceService = (dependencies: VoiceServiceDependencies) => {
  const publishCall = (call: CallSessionRecord) => {
    try {
      dependencies.realtime.callUpdated(
        [call.callerUserId, call.recipientUserId],
        { call: toCallDto(call) },
      );
    } catch (error) {
      dependencies.logger.error({ err: error }, "Voice call delivery failed");
    }
  };

  const getCallForUser = async (userId: string, callId: string) => {
    const call = await dependencies.calls.findById(callId);
    if (!call) throw new CallNotFoundError();
    if (call.callerUserId !== userId && call.recipientUserId !== userId) {
      throw new CallNotFoundError();
    }
    await dependencies.conversations.getAccessible(userId, call.conversationId);
    return call;
  };

  const audienceFor = async (
    conversation: ConversationRecord,
    actorUserId: string,
  ) => {
    const otherUserIds =
      conversation.visibility === "PUBLIC"
        ? await dependencies.audiences.listOrganizationMemberUserIds(
            conversation.organizationId,
            actorUserId,
          )
        : await dependencies.audiences.listParticipantMemberUserIds(
            conversation.organizationId,
            conversation.id,
            actorUserId,
          );
    return [actorUserId, ...otherUserIds];
  };

  const occupancyFor = async (
    conversationId: string,
  ): Promise<VoiceOccupancyDto> => {
    const sessions =
      await dependencies.sessions.listByConversation(conversationId);
    return {
      conversationId,
      capacity: VOICE_CAPACITY,
      participantUserIds: sessions.map(({ userId }) => userId),
      participants: sessions.map(({ userId, participantIdentity }) => ({
        userId,
        participantIdentity,
      })),
    };
  };

  const publishOccupancy = async (
    conversation: ConversationRecord,
    actorUserId: string,
  ) => {
    try {
      dependencies.realtime.voiceOccupancyUpdated(
        await audienceFor(conversation, actorUserId),
        await occupancyFor(conversation.id),
      );
    } catch (error) {
      dependencies.logger.error(
        { err: error, conversationId: conversation.id },
        "Voice occupancy delivery failed",
      );
    }
  };

  const closeProviderRoom = async (providerRoomId: string) => {
    try {
      await dependencies.media.closeRoom(providerRoomId);
    } catch (error) {
      dependencies.logger.error(
        { err: error },
        "Voice provider room cleanup failed",
      );
    }
  };

  const endCallRecord = async (
    call: CallSessionRecord,
    reason: (typeof CallEndReason)[keyof typeof CallEndReason],
    from = [CallStatus.RINGING, CallStatus.CONNECTING, CallStatus.ACTIVE],
  ) => {
    if (call.status === CallStatus.ENDED) return call;
    const ended = await dependencies.calls.transition(call.id, from, {
      status: CallStatus.ENDED,
      endReason: reason,
      endedAt: new Date(),
    });
    const result = ended ?? (await dependencies.calls.findById(call.id));
    if (!result) throw new CallNotFoundError();
    const currentSessions = await Promise.all(
      [call.callerUserId, call.recipientUserId].map((userId) =>
        dependencies.sessions.getByUser(userId),
      ),
    );
    await dependencies.sessions.releaseSessions(
      currentSessions.filter(
        (session): session is VoiceSessionRecord => session?.callId === call.id,
      ),
    );
    await closeProviderRoom(call.providerRoomId);
    if (ended) {
      dependencies.telemetry?.recordVoiceCall({
        event: "ended",
        outcome: reason.toLowerCase(),
      });
    }
    publishCall(result);
    return result;
  };

  const cleanupReplacedSessions = async (
    replaced: readonly VoiceSessionRecord[],
  ) => {
    for (const session of replaced) {
      try {
        await dependencies.media.removeParticipant(
          session.providerRoomId,
          session.participantIdentity,
        );
        if (session.callId) {
          const call = await dependencies.calls.findById(session.callId);
          if (call) await endCallRecord(call, CallEndReason.COMPLETED);
        } else {
          const conversation = await dependencies.conversations.getAccessible(
            session.userId,
            session.conversationId,
          );
          await publishOccupancy(conversation, session.userId);
        }
      } catch (error) {
        dependencies.logger.error(
          { err: error },
          "Previous voice session cleanup failed",
        );
      } finally {
        try {
          await dependencies.sessions.releaseSessions([session]);
        } catch (error) {
          dependencies.logger.error(
            { err: error },
            "Previous voice session lease cleanup failed",
          );
        }
      }
    }
  };

  const reserve = async (
    sessions: readonly VoiceSessionRecord[],
    actorUserId: string,
    replaceActiveSession: boolean,
    maxConversationParticipants?: number,
  ) => {
    const result = await dependencies.sessions.reserve(
      sessions,
      replaceActiveSession ? actorUserId : undefined,
      maxConversationParticipants,
    );
    if (result.capacityExceeded) throw new VoiceCapacityError();
    if (result.conflict) {
      if (result.conflict.userId !== actorUserId)
        throw new VoiceUserBusyError();
      throw new VoiceSessionActiveError();
    }
    await cleanupReplacedSessions(result.replaced);
  };

  const issueCredentials = async (session: VoiceSessionRecord) => {
    const startedAt = performance.now();
    try {
      const credentials = voiceCredentialsDtoSchema.parse(
        await dependencies.media.createJoinCredentials({
          providerRoomId: session.providerRoomId,
          participantIdentity: session.participantIdentity,
          capacity: VOICE_CAPACITY,
        }),
      );
      dependencies.telemetry?.recordVoiceJoin({
        durationSeconds: (performance.now() - startedAt) / 1_000,
        kind: session.kind === VoiceSessionKind.CALL ? "call" : "voice_channel",
        result: "success",
      });
      return credentials;
    } catch (error) {
      dependencies.telemetry?.recordVoiceJoin({
        durationSeconds: (performance.now() - startedAt) / 1_000,
        kind: session.kind === VoiceSessionKind.CALL ? "call" : "voice_channel",
        result: "failure",
      });
      if (error instanceof VoiceUnavailableError) throw error;
      dependencies.logger.error({ err: error }, "Voice credentials failed");
      throw new VoiceUnavailableError();
    }
  };

  const assertVoiceChannel = (conversation: ConversationRecord) => {
    if (
      !isChannelConversation(conversation) ||
      conversation.kind !== ChannelKind.VOICE ||
      !conversation.voiceRoomId
    ) {
      throw new ConversationConflictError(
        "Conversation is not a voice channel",
      );
    }
    return conversation;
  };

  const activateProviderSession = async (session: VoiceSessionRecord) => {
    await dependencies.sessions.activate(
      session.userId,
      session.id,
      new Date(),
    );
    if (!session.callId) {
      const conversation = await dependencies.conversations.getAccessible(
        session.userId,
        session.conversationId,
      );
      await publishOccupancy(conversation, session.userId);
      return;
    }
    const call = await dependencies.calls.findById(session.callId);
    if (call?.status !== CallStatus.CONNECTING) return;
    const participantSessions = await Promise.all(
      [call.callerUserId, call.recipientUserId].map((participantUserId) =>
        dependencies.sessions.getByUser(participantUserId),
      ),
    );
    const bothConnected = participantSessions.every(
      (participantSession) =>
        participantSession?.callId === call.id &&
        participantSession.connectedAt !== null,
    );
    if (!bothConnected) return;
    const active = await dependencies.calls.transition(
      call.id,
      [CallStatus.CONNECTING],
      { status: CallStatus.ACTIVE, answeredAt: new Date() },
    );
    if (active) publishCall(active);
  };

  const service = {
    occupancy: {
      list: async (conversationIds: readonly string[]) =>
        Promise.all(conversationIds.map(occupancyFor)),
    },

    async joinChannel(
      userId: string,
      conversationId: string,
      input: JoinVoiceSessionInput,
    ) {
      const conversation = assertVoiceChannel(
        await dependencies.conversations.getAccessible(userId, conversationId),
      );
      const providerParticipants =
        await dependencies.media.listParticipantIdentities(
          conversation.voiceRoomId as string,
        );
      if (providerParticipants.length >= VOICE_CAPACITY) {
        throw new VoiceCapacityError();
      }
      const sessionId = randomUUID();
      const session: VoiceSessionRecord = {
        id: sessionId,
        kind: VoiceSessionKind.VOICE_CHANNEL,
        organizationId: conversation.organizationId,
        conversationId: conversation.id,
        callId: null,
        userId,
        participantIdentity: sessionId,
        providerRoomId: conversation.voiceRoomId as string,
        connectedAt: null,
      };
      await reserve(
        sessionsOrOne(session),
        userId,
        input.replaceActiveSession,
        VOICE_CAPACITY,
      );
      try {
        return {
          session: sessionDto(session),
          credentials: await issueCredentials(session),
        };
      } catch (error) {
        await dependencies.sessions.releaseSessions([session]);
        throw error;
      }
    },

    async startCall(
      userId: string,
      conversationId: string,
      input: JoinVoiceSessionInput,
    ) {
      const conversation = await dependencies.conversations.getAccessible(
        userId,
        conversationId,
      );
      if (conversation.type !== ConversationType.DIRECT) {
        throw new ConversationConflictError(
          "Calls require a direct conversation",
        );
      }
      const participants =
        await dependencies.participants.listByConversation(conversationId);
      const recipient = participants.find(
        ({ userId: participantUserId }) => participantUserId !== userId,
      );
      if (!recipient) throw new ConversationNotFoundError();
      const callId = new Types.ObjectId().toString();
      const providerRoomId = randomUUID();
      const callerSessionId = randomUUID();
      const callerSession: VoiceSessionRecord = {
        id: callerSessionId,
        kind: VoiceSessionKind.CALL,
        organizationId: conversation.organizationId,
        conversationId,
        callId,
        userId,
        participantIdentity: callerSessionId,
        providerRoomId,
        connectedAt: null,
      };
      const recipientSessionId = randomUUID();
      const recipientSession: VoiceSessionRecord = {
        ...callerSession,
        id: recipientSessionId,
        userId: recipient.userId,
        participantIdentity: recipientSessionId,
      };
      const reservedSessions = [callerSession, recipientSession];
      await reserve(reservedSessions, userId, input.replaceActiveSession);
      let credentials;
      try {
        credentials = await issueCredentials(callerSession);
      } catch (error) {
        await dependencies.sessions.releaseSessions(reservedSessions);
        throw error;
      }

      let result: {
        call: CallSessionRecord;
        message: MessageRecord;
        conversation: ConversationRecord;
      };
      try {
        result = await dependencies.unitOfWork.run(async (context) => {
          const currentConversation =
            await dependencies.conversations.getAccessibleInContext(
              userId,
              conversationId,
              context,
            );
          if (currentConversation.type !== ConversationType.DIRECT) {
            throw new ConversationNotFoundError();
          }
          if (
            !(await context.organizations.lockForMutation(
              currentConversation.organizationId,
            ))
          ) {
            throw new ConversationNotFoundError();
          }
          const startedAt = new Date();
          const transactionCalls = context.calls ?? dependencies.calls;
          const call = await transactionCalls.create({
            id: callId,
            organizationId: currentConversation.organizationId,
            conversationId,
            callerUserId: userId,
            recipientUserId: recipient.userId,
            providerRoomId,
            startedAt,
          });
          const message = await context.messages.create({
            conversationId,
            senderId: userId,
            content: null,
            messageType: MessageType.CALL,
            callId,
          });
          const linkedCall = await transactionCalls.setTimelineMessageId(
            call.id,
            message.id,
          );
          if (!linkedCall) throw new CallNotFoundError();
          if (
            !(await context.conversations.touchActivity(
              conversationId,
              message.createdAt,
            ))
          ) {
            throw new ConversationNotFoundError();
          }
          return {
            call: linkedCall,
            message,
            conversation: currentConversation,
          };
        });
      } catch (error) {
        await dependencies.sessions.releaseSessions(reservedSessions);
        await closeProviderRoom(providerRoomId);
        throw error;
      }

      const dto = toCallDto(result.call);
      dependencies.telemetry?.recordVoiceCall({
        event: "started",
        outcome: "started",
      });
      try {
        await dependencies.jobs.schedule(
          result.call.id,
          VoiceCallJobKind.RING_TIMEOUT,
          RING_TIMEOUT_MS,
        );
      } catch (error) {
        dependencies.logger.error(
          { err: error },
          "Voice call timeout scheduling failed",
        );
        await endCallRecord(result.call, CallEndReason.FAILED, [
          CallStatus.RINGING,
        ]);
        throw new VoiceUnavailableError();
      }
      try {
        dependencies.broadcaster.messageCreated({
          ...result.message,
          call: toCallSummaryDto(result.call),
        });
      } catch (error) {
        dependencies.logger.error(
          { err: error },
          "Voice call message delivery failed",
        );
      }
      try {
        await dependencies.activity.messageCreated(result.conversation, userId);
      } catch (error) {
        dependencies.logger.error(
          { err: error },
          "Voice call activity delivery failed",
        );
      }
      try {
        dependencies.realtime.callIncoming(recipient.userId, { call: dto });
      } catch (error) {
        dependencies.logger.error(
          { err: error },
          "Incoming voice call delivery failed",
        );
      }
      publishCall(result.call);
      return { call: dto, credentials };
    },

    async getCall(userId: string, callId: string) {
      return toCallDto(await getCallForUser(userId, callId));
    },

    async acceptCall(userId: string, callId: string) {
      const call = await getCallForUser(userId, callId);
      if (call.recipientUserId !== userId) throw new CallForbiddenError();
      const transitioned = await dependencies.calls.transition(
        call.id,
        [CallStatus.RINGING],
        { status: CallStatus.CONNECTING, acceptedAt: new Date() },
      );
      if (!transitioned) throw new CallConflictError();
      const session = await dependencies.sessions.getByUser(userId);
      if (!session || session.callId !== call.id) {
        throw new CallConflictError("Call reservation expired");
      }
      const credentials = await issueCredentials(session);
      publishCall(transitioned);
      await dependencies.jobs.schedule(
        call.id,
        VoiceCallJobKind.CONNECT_TIMEOUT,
        CONNECT_TIMEOUT_MS,
      );
      return { call: toCallDto(transitioned), credentials };
    },

    async declineCall(userId: string, callId: string) {
      const call = await getCallForUser(userId, callId);
      if (call.recipientUserId !== userId) throw new CallForbiddenError();
      return toCallDto(
        await endCallRecord(call, CallEndReason.DECLINED, [CallStatus.RINGING]),
      );
    },

    async cancelCall(userId: string, callId: string) {
      const call = await getCallForUser(userId, callId);
      if (call.callerUserId !== userId) throw new CallForbiddenError();
      return toCallDto(
        await endCallRecord(call, CallEndReason.CANCELLED, [
          CallStatus.RINGING,
          CallStatus.CONNECTING,
        ]),
      );
    },

    async endCall(userId: string, callId: string) {
      const call = await getCallForUser(userId, callId);
      if (call.status === CallStatus.ENDED) return toCallDto(call);
      if (![call.callerUserId, call.recipientUserId].includes(userId)) {
        throw new CallForbiddenError();
      }
      return toCallDto(
        await endCallRecord(
          call,
          call.answeredAt ? CallEndReason.COMPLETED : CallEndReason.FAILED,
          [CallStatus.CONNECTING, CallStatus.ACTIVE],
        ),
      );
    },

    async getActiveSession(userId: string) {
      const session = await dependencies.sessions.getByUser(userId);
      return session ? sessionDto(session) : null;
    },

    async resumeSession(userId: string) {
      const session = await dependencies.sessions.getByUser(userId);
      if (!session) throw new CallConflictError("Voice session has expired");
      await dependencies.conversations.getAccessible(
        userId,
        session.conversationId,
      );
      if (session.callId) {
        const call = await getCallForUser(userId, session.callId);
        if (
          call.status === CallStatus.ENDED ||
          (call.status === CallStatus.RINGING &&
            call.recipientUserId === userId)
        ) {
          throw new CallConflictError("Call cannot be resumed");
        }
      }
      return {
        session: sessionDto(session),
        credentials: await issueCredentials(session),
      };
    },

    async leaveCurrentSession(userId: string) {
      const session = await dependencies.sessions.getByUser(userId);
      if (!session) return;
      if (session.callId) {
        const call = await dependencies.calls.findById(session.callId);
        if (call) {
          await endCallRecord(
            call,
            call.answeredAt ? CallEndReason.COMPLETED : CallEndReason.CANCELLED,
          );
          return;
        }
      }
      await dependencies.media.removeParticipant(
        session.providerRoomId,
        session.participantIdentity,
      );
      await dependencies.sessions.releaseSessions([session]);
      const conversation = await dependencies.conversations.getAccessible(
        userId,
        session.conversationId,
      );
      await publishOccupancy(conversation, userId);
    },

    heartbeat: (userId: string, sessionId: string) =>
      dependencies.sessions.heartbeat(userId, sessionId),

    async closeConversation(conversationId: string, providerRoomId?: string) {
      const sessions =
        await dependencies.sessions.listReservedByConversation(conversationId);
      const callIds = [
        ...new Set(
          sessions.flatMap((session) =>
            session.callId ? [session.callId] : [],
          ),
        ),
      ];
      for (const callId of callIds) {
        const call = await dependencies.calls.findById(callId);
        if (call) {
          await endCallRecord(call, CallEndReason.ACCESS_REVOKED);
        }
      }
      const remainingSessions = (
        await Promise.all(
          sessions.map(async (session) => {
            const current = await dependencies.sessions.getByUser(
              session.userId,
            );
            return current?.id === session.id ? current : null;
          }),
        )
      ).filter((session): session is VoiceSessionRecord => session !== null);
      await Promise.all(
        remainingSessions.map(async (session) => {
          try {
            await dependencies.media.removeParticipant(
              session.providerRoomId,
              session.participantIdentity,
            );
          } catch (error) {
            dependencies.logger.error(
              { err: error },
              "Voice participant cleanup failed",
            );
          }
        }),
      );
      await dependencies.sessions.releaseSessions(remainingSessions);
      await Promise.all(
        [
          ...new Set(
            remainingSessions.map(({ providerRoomId: roomId }) => roomId),
          ),
        ]
          .filter((roomId) => roomId !== providerRoomId)
          .map(closeProviderRoom),
      );
      if (providerRoomId) await closeProviderRoom(providerRoomId);
    },

    async retainOnlyUser(
      conversationId: string,
      retainedUserId: string,
      actorUserId: string,
    ) {
      const sessions = (
        await dependencies.sessions.listReservedByConversation(conversationId)
      ).filter(({ userId }) => userId !== retainedUserId);
      await Promise.all(
        sessions.map(async (session) => {
          if (session.callId) {
            const call = await dependencies.calls.findById(session.callId);
            if (call) await endCallRecord(call, CallEndReason.ACCESS_REVOKED);
            return;
          }
          await dependencies.media.removeParticipant(
            session.providerRoomId,
            session.participantIdentity,
          );
          await dependencies.sessions.releaseSessions([session]);
        }),
      );
      const conversation = await dependencies.conversations.getAccessible(
        actorUserId,
        conversationId,
      );
      await publishOccupancy(conversation, actorUserId);
    },

    async revokeUser(
      conversationId: string,
      participantUserId: string,
      actorUserId: string,
    ) {
      const session = await dependencies.sessions.getByUser(participantUserId);
      if (!session || session.conversationId !== conversationId) return;
      if (session.callId) {
        const call = await dependencies.calls.findById(session.callId);
        if (call) await endCallRecord(call, CallEndReason.ACCESS_REVOKED);
        return;
      }
      await dependencies.media.removeParticipant(
        session.providerRoomId,
        session.participantIdentity,
      );
      await dependencies.sessions.releaseSessions([session]);
      const conversation = await dependencies.conversations.getAccessible(
        actorUserId,
        conversationId,
      );
      await publishOccupancy(conversation, actorUserId);
    },

    async muteParticipant(
      ownerUserId: string,
      conversationId: string,
      participantUserId: string,
    ) {
      const conversation = assertVoiceChannel(
        await dependencies.conversations.getAccessible(
          ownerUserId,
          conversationId,
        ),
      );
      const membership = await dependencies.memberships.findForUser(
        ownerUserId,
        conversation.organizationId,
      );
      dependencies.conversationPolicy.assertOwner(conversation, membership);
      const session = await dependencies.sessions.getByUser(participantUserId);
      if (!session || session.conversationId !== conversationId) {
        throw new ConversationNotFoundError();
      }
      await dependencies.media.muteParticipant(
        conversation.voiceRoomId as string,
        session.participantIdentity,
      );
    },

    async disconnectParticipant(
      ownerUserId: string,
      conversationId: string,
      participantUserId: string,
    ) {
      const conversation = assertVoiceChannel(
        await dependencies.conversations.getAccessible(
          ownerUserId,
          conversationId,
        ),
      );
      const membership = await dependencies.memberships.findForUser(
        ownerUserId,
        conversation.organizationId,
      );
      dependencies.conversationPolicy.assertOwner(conversation, membership);
      const session = await dependencies.sessions.getByUser(participantUserId);
      if (session?.conversationId === conversationId) {
        await dependencies.media.removeParticipant(
          conversation.voiceRoomId as string,
          session.participantIdentity,
        );
        await dependencies.sessions.releaseSessions([session]);
      }
      await publishOccupancy(conversation, ownerUserId);
    },

    async handleWebhook(body: string, authorization?: string) {
      const event = await dependencies.media.parseWebhook(body, authorization);
      if (!(await dependencies.sessions.claimWebhook(event.id))) return;
      if (!event.providerRoomId) return;
      if (event.kind === "room_finished") {
        const call = await dependencies.calls.findByProviderRoomId(
          event.providerRoomId,
        );
        if (call && call.status !== CallStatus.ENDED) {
          await endCallRecord(
            call,
            call.answeredAt ? CallEndReason.COMPLETED : CallEndReason.FAILED,
          );
        }
        return;
      }
      if (!event.participantIdentity) return;
      const session = await dependencies.sessions.getById(
        event.participantIdentity,
      );
      if (!session || session.providerRoomId !== event.providerRoomId) return;
      if (event.kind === "participant_joined") {
        await activateProviderSession(session);
        return;
      }
      if (
        event.kind === "participant_left" ||
        event.kind === "participant_connection_aborted"
      ) {
        if (session.callId) {
          await dependencies.sessions.markDisconnected(
            session.userId,
            session.id,
          );
          await dependencies.jobs.schedule(
            session.callId,
            VoiceCallJobKind.DISCONNECT_TIMEOUT,
            DISCONNECT_TIMEOUT_MS,
          );
        } else {
          await dependencies.sessions.releaseSessions([session]);
          const conversation = await dependencies.conversations.getAccessible(
            session.userId,
            session.conversationId,
          );
          await publishOccupancy(conversation, session.userId);
        }
      }
    },

    async handleJob(input: {
      kind: (typeof VoiceCallJobKind)[keyof typeof VoiceCallJobKind];
      callId?: string;
    }) {
      if (input.kind === VoiceCallJobKind.RECONCILE) {
        try {
          const now = Date.now();
          const timedOutCalls = await dependencies.calls.findTimedOutPending({
            connectingAcceptedBefore: new Date(now - CONNECT_TIMEOUT_MS),
            ringingStartedBefore: new Date(now - RING_TIMEOUT_MS),
          });
          for (const call of timedOutCalls) {
            if (call.status === CallStatus.RINGING) {
              await endCallRecord(call, CallEndReason.MISSED, [
                CallStatus.RINGING,
              ]);
            } else if (call.status === CallStatus.CONNECTING) {
              await endCallRecord(call, CallEndReason.FAILED, [
                CallStatus.CONNECTING,
              ]);
            }
          }
        } catch (error) {
          dependencies.logger.warn(
            { err: error },
            "Voice call timeout reconciliation failed",
          );
        }
        const sessions = await dependencies.sessions.listReserved();
        const sessionsByRoom = new Map<string, VoiceSessionRecord[]>();
        for (const session of sessions) {
          const roomSessions = sessionsByRoom.get(session.providerRoomId) ?? [];
          roomSessions.push(session);
          sessionsByRoom.set(session.providerRoomId, roomSessions);
        }
        for (const [providerRoomId, roomSessions] of sessionsByRoom) {
          try {
            const providerIdentities = new Set(
              await dependencies.media.listParticipantIdentities(
                providerRoomId,
              ),
            );
            const knownIdentities = new Set(
              roomSessions.map(
                ({ participantIdentity }) => participantIdentity,
              ),
            );
            await Promise.all(
              [...providerIdentities]
                .filter((identity) => !knownIdentities.has(identity))
                .map((identity) =>
                  dependencies.media.removeParticipant(
                    providerRoomId,
                    identity,
                  ),
                ),
            );
            for (const session of roomSessions) {
              if (providerIdentities.has(session.participantIdentity)) {
                if (session.connectedAt === null) {
                  await activateProviderSession(session);
                }
                continue;
              }
              if (session.connectedAt === null) continue;
              if (session.callId) {
                await dependencies.sessions.markDisconnected(
                  session.userId,
                  session.id,
                );
                await dependencies.jobs.schedule(
                  session.callId,
                  VoiceCallJobKind.DISCONNECT_TIMEOUT,
                  DISCONNECT_TIMEOUT_MS,
                );
              } else {
                await dependencies.sessions.releaseSessions([session]);
                const conversation =
                  await dependencies.conversations.getAccessible(
                    session.userId,
                    session.conversationId,
                  );
                await publishOccupancy(conversation, session.userId);
              }
            }
          } catch (error) {
            dependencies.logger.warn(
              { err: error },
              "Voice provider reconciliation failed",
            );
          }
        }
        return;
      }
      if (!input.callId) return;
      const call = await dependencies.calls.findById(input.callId);
      if (!call || call.status === CallStatus.ENDED) return;
      if (
        input.kind === VoiceCallJobKind.RING_TIMEOUT &&
        call.status === CallStatus.RINGING
      ) {
        await endCallRecord(call, CallEndReason.MISSED, [CallStatus.RINGING]);
        return;
      }
      if (
        input.kind === VoiceCallJobKind.CONNECT_TIMEOUT &&
        call.status === CallStatus.CONNECTING
      ) {
        await endCallRecord(call, CallEndReason.FAILED, [
          CallStatus.CONNECTING,
        ]);
        return;
      }
      if (
        input.kind === VoiceCallJobKind.DISCONNECT_TIMEOUT &&
        call.status === CallStatus.ACTIVE
      ) {
        const states = await Promise.all(
          [call.callerUserId, call.recipientUserId].map((participantUserId) =>
            dependencies.sessions.getByUser(participantUserId),
          ),
        );
        if (
          states.some(
            (state) => state?.callId !== call.id || state.connectedAt === null,
          )
        ) {
          await endCallRecord(call, CallEndReason.COMPLETED, [
            CallStatus.ACTIVE,
          ]);
        }
      }
    },

    decorateMessages: async <T extends MessageRecord>(
      records: readonly T[],
    ) => {
      const callIds = records.flatMap((record) =>
        record.callId ? [record.callId] : [],
      );
      const calls = await dependencies.calls.findByIds(callIds);
      const byId = new Map(
        calls.map((call) => [call.id, toCallSummaryDto(call)]),
      );
      return records.map((record) =>
        record.callId
          ? { ...record, call: byId.get(record.callId) ?? null }
          : record,
      );
    },
  };

  dependencies.jobs.setHandler((input) => service.handleJob(input));
  return service;
};

const sessionsOrOne = (session: VoiceSessionRecord) => [session];

export type VoiceService = ReturnType<typeof createVoiceService>;
export default createVoiceService;
