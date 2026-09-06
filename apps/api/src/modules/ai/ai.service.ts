import { randomUUID } from "node:crypto";

import {
  AiComposeAction,
  AiScopeKind,
  AiSummaryMode,
  AiTask,
  type AiConsentUpdate,
  type AiOrganizationSettingsUpdate,
  type AiResponseRequest,
  type AiSettingsDto,
  type AiWorkspaceSource,
} from "@intouch/shared/ai";
import {
  ChannelKind,
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import type { Logger } from "pino";

import type { ConversationAccessScopeService } from "../conversations/conversation-access-scope.service.js";
import { ConversationNotFoundError } from "../conversations/conversation.errors.js";
import type { MessageRepository } from "../message/message.repository.js";
import { MessageType } from "../message/message.types.js";
import {
  MembershipRole,
  type MembershipService,
} from "../memberships/index.js";
import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import type { OrganizationRepository } from "../organizations/organization.repository.js";
import { SearchPersistenceUnavailableError } from "../search/search.errors.js";
import type { SearchRepository } from "../search/search.types.js";
import type { UserRepository } from "../user/user.repository.js";
import {
  AiConsentRequiredError,
  AiContextUnavailableError,
  AiNotEnabledError,
  AiQuotaExceededError,
  AiResponseBlockedError,
  AiUnavailableError,
} from "./ai.errors.js";
import {
  AiProviderBlockedError,
  AiProviderUnavailableError,
} from "./ai.provider.js";
import type { AiRepository } from "./ai.repository.js";
import type { AiUnitOfWork } from "./ai.unit-of-work.js";
import type {
  AiPreparedResponse,
  AiProvider,
  AiProviderChunk,
  AiQuotaStore,
} from "./ai.types.js";

export const AI_DISCLOSURE_VERSION = "ai-data-use-v1";
const ASK_CONTEXT_LIMIT = 24_000;
const SUMMARY_CONTEXT_LIMIT = 40_000;
const SOURCE_EXCERPT_LIMIT = 180;

const redactSecrets = (value: string) =>
  value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "[REDACTED_TOKEN]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    )
    .replace(
      /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
      "[REDACTED_PRIVATE_KEY]",
    )
    .replace(
      /\b(api[_-]?key|secret|token)\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}["']?/gi,
      "$1=[REDACTED_SECRET]",
    );

const truncate = (value: string, maximum: number) =>
  value.length <= maximum ? value : `${value.slice(0, maximum - 3)}...`;

const composeInstruction = (
  request: Extract<AiResponseRequest, { task: "COMPOSE" }>,
) => {
  const action = {
    [AiComposeAction.REWRITE_PROFESSIONAL]:
      "Rewrite the draft in a clear, professional tone.",
    [AiComposeAction.SHORTEN]:
      "Shorten the draft while preserving its meaning.",
    [AiComposeAction.FIX_GRAMMAR]:
      "Correct grammar and spelling while preserving tone and meaning.",
    [AiComposeAction.TRANSLATE]: `Translate the draft to ${request.targetLanguage ?? "the requested language"}.`,
  }[request.action];
  return `${action}\nReturn only the revised message, with no quotation marks or commentary.\n\nDraft:\n${request.text}`;
};

export interface AiServiceDependencies {
  accessScope: ConversationAccessScopeService;
  dailyOrganizationRequests: number;
  dailyUserRequests: number;
  logger: Logger;
  memberships: MembershipService;
  messages: MessageRepository;
  model: string;
  organizationPolicy: OrganizationPolicy;
  organizations: OrganizationRepository;
  provider: AiProvider;
  quota: AiQuotaStore;
  repository: AiRepository;
  search: SearchRepository;
  serviceTier: "free" | "paid";
  telemetry?: {
    recordAiRequest(input: {
      durationSeconds: number;
      task: string;
      scope: string;
      provider: string;
      model: string;
      result: "success" | "failure";
    }): void;
    recordAiContext(input: {
      characters: number;
      sources: number;
      task: string;
    }): void;
    recordAiTokens(input: {
      inputTokens: number;
      outputTokens: number;
      task: string;
    }): void;
  };
  unitOfWork: AiUnitOfWork;
  users: Pick<UserRepository, "findPublicByIds">;
  now?: () => Date;
}

const createAiService = ({
  accessScope,
  dailyOrganizationRequests,
  dailyUserRequests,
  logger,
  memberships,
  messages,
  model,
  organizationPolicy,
  organizations,
  provider,
  quota,
  repository,
  search,
  serviceTier,
  telemetry,
  unitOfWork,
  users,
  now = () => new Date(),
}: AiServiceDependencies) => {
  const authorizeMember = async (userId: string, organizationId: string) => {
    const [organization, membership] = await Promise.all([
      organizations.findById(organizationId),
      memberships.findForUser(userId, organizationId),
    ]);
    organizationPolicy.assertMember(organization, membership);
    return membership;
  };

  const assertEnabledAndConsented = async (
    userId: string,
    organizationId: string,
  ) => {
    await authorizeMember(userId, organizationId);
    const [settings, consent] = await Promise.all([
      repository.findSettings(organizationId),
      repository.findConsent(organizationId, userId),
    ]);
    if (
      !settings?.enabled ||
      settings.disclosureVersion !== AI_DISCLOSURE_VERSION
    ) {
      throw new AiNotEnabledError();
    }
    if (consent?.disclosureVersion !== AI_DISCLOSURE_VERSION) {
      throw new AiConsentRequiredError();
    }
  };

  const settingsDto = async (
    userId: string,
    organizationId: string,
  ): Promise<AiSettingsDto> => {
    const membership = await authorizeMember(userId, organizationId);
    const [settings, consent, quotaStatus] = await Promise.all([
      repository.findSettings(organizationId),
      repository.findConsent(organizationId, userId),
      quota.getStatus(userId, organizationId),
    ]);
    return {
      available: provider.name !== "disabled",
      organizationEnabled:
        settings?.enabled === true &&
        settings.disclosureVersion === AI_DISCLOSURE_VERSION,
      userConsentAccepted: consent?.disclosureVersion === AI_DISCLOSURE_VERSION,
      canManage: membership?.role === MembershipRole.OWNER,
      disclosureVersion: AI_DISCLOSURE_VERSION,
      provider: "GEMINI",
      serviceTier: serviceTier.toUpperCase() as "FREE" | "PAID",
      dataUseNotice:
        serviceTier === "free"
          ? "Requests and authorized workspace excerpts are sent to Gemini. Google may use unpaid-service content to improve its products."
          : "Requests and authorized workspace excerpts are sent to Gemini under the configured paid-service data terms.",
      quota: {
        ...quotaStatus,
        resetsAt: quotaStatus.resetsAt.toISOString(),
      },
    };
  };

  const updateSettings = async (
    userId: string,
    organizationId: string,
    input: AiOrganizationSettingsUpdate,
  ) => {
    const [organization, membership] = await Promise.all([
      organizations.findById(organizationId),
      memberships.findForUser(userId, organizationId),
    ]);
    organizationPolicy.assertOwner(organization, membership);
    if (input.disclosureVersion !== AI_DISCLOSURE_VERSION) {
      throw new AiConsentRequiredError();
    }
    await unitOfWork.run(async (transactionalRepository) => {
      if (input.enabled) {
        await transactionalRepository.setEnabled({
          organizationId,
          userId,
          disclosureVersion: AI_DISCLOSURE_VERSION,
          now: now(),
        });
        await transactionalRepository.acceptConsent({
          organizationId,
          userId,
          disclosureVersion: AI_DISCLOSURE_VERSION,
          now: now(),
        });
        return;
      }
      await transactionalRepository.disable(organizationId);
      await transactionalRepository.deleteConsentsByOrganization(
        organizationId,
      );
    });
    return settingsDto(userId, organizationId);
  };

  const acceptConsent = async (
    userId: string,
    organizationId: string,
    input: AiConsentUpdate,
  ) => {
    await authorizeMember(userId, organizationId);
    const settings = await repository.findSettings(organizationId);
    if (
      !settings?.enabled ||
      settings.disclosureVersion !== AI_DISCLOSURE_VERSION
    ) {
      throw new AiNotEnabledError();
    }
    if (input.disclosureVersion !== AI_DISCLOSURE_VERSION) {
      throw new AiConsentRequiredError();
    }
    await repository.acceptConsent({
      organizationId,
      userId,
      disclosureVersion: AI_DISCLOSURE_VERSION,
      now: now(),
    });
    return settingsDto(userId, organizationId);
  };

  const revokeConsent = async (userId: string, organizationId: string) => {
    await authorizeMember(userId, organizationId);
    await repository.deleteConsent(organizationId, userId);
    return settingsDto(userId, organizationId);
  };

  const buildContext = async (
    userId: string,
    organizationId: string,
    request: Exclude<AiResponseRequest, { task: "COMPOSE" }>,
  ) => {
    const scope = await accessScope.getForUser(userId, organizationId);
    const allConversations = [
      ...scope.accessibleChannels,
      ...scope.directConversations,
    ];
    const selectedConversationId =
      request.task === AiTask.SUMMARIZE
        ? request.conversationId
        : request.scope.kind === AiScopeKind.CONVERSATION
          ? request.scope.conversationId
          : undefined;
    const selectedConversation = selectedConversationId
      ? allConversations.find(({ id }) => id === selectedConversationId)
      : undefined;
    if (selectedConversationId && !selectedConversation) {
      throw new ConversationNotFoundError();
    }
    if (
      selectedConversation?.type === ConversationType.CHANNEL &&
      selectedConversation.kind !== ChannelKind.TEXT
    ) {
      throw new ConversationNotFoundError();
    }

    let records: Array<{
      id: string;
      conversationId: string;
      senderId: string;
      content: string;
      createdAt: Date;
    }> = [];
    try {
      if (request.task === AiTask.ASK) {
        const allowedIds = selectedConversation
          ? [selectedConversation.id]
          : scope.accessibleChannels
              .filter(
                ({ kind, visibility }) =>
                  kind === ChannelKind.TEXT &&
                  visibility === ConversationVisibility.PUBLIC,
              )
              .map(({ id }) => id);
        records = (
          await search.searchMessages({
            query: request.prompt,
            allowedIds,
            limit: 20,
            ...(selectedConversation
              ? { conversationId: selectedConversation.id }
              : {}),
          })
        ).records;
      } else if (selectedConversation) {
        records = (
          await messages.listByConversation(
            selectedConversation.id,
            undefined,
            120,
          )
        )
          .filter(
            (message) =>
              !message.deletedAt &&
              message.content &&
              message.messageType !== MessageType.CALL,
          )
          .slice(0, 100)
          .reverse()
          .map((message) => ({
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content ?? "",
            createdAt: message.createdAt,
          }));
      }
    } catch (error) {
      if (error instanceof SearchPersistenceUnavailableError) {
        throw new AiContextUnavailableError();
      }
      throw error;
    }

    const senderIds = [...new Set(records.map(({ senderId }) => senderId))];
    const publicUsers = await users.findPublicByIds(senderIds);
    const usersById = new Map(publicUsers.map((user) => [user.id, user]));
    const aliases = new Map(
      senderIds.map((senderId, index) => [senderId, `Member ${index + 1}`]),
    );
    const conversationsById = new Map(
      allConversations.map((conversation) => [conversation.id, conversation]),
    );
    const maximum =
      request.task === AiTask.SUMMARIZE
        ? SUMMARY_CONTEXT_LIMIT
        : ASK_CONTEXT_LIMIT;
    let used = 0;
    const accepted = records.filter((record) => {
      const length = record.content.length;
      if (used + length > maximum) return false;
      used += length;
      return true;
    });
    const sources: AiWorkspaceSource[] = accepted.flatMap((record, index) => {
      const sender = usersById.get(record.senderId);
      const conversation = conversationsById.get(record.conversationId);
      if (!sender || !conversation) return [];
      return [
        {
          sourceId: `S${index + 1}`,
          messageId: record.id,
          conversationId: record.conversationId,
          conversationType: conversation.type,
          conversationLabel:
            conversation.type === ConversationType.CHANNEL
              ? (conversation.name ?? "Channel")
              : "Direct message",
          sender: {
            id: sender.id,
            username: sender.username,
            displayName: sender.displayName,
            avatarAssetId: sender.avatarAssetId ?? null,
            ...(sender.avatarUrl ? { avatarUrl: sender.avatarUrl } : {}),
          },
          createdAt: record.createdAt.toISOString(),
          excerpt: truncate(record.content, SOURCE_EXCERPT_LIMIT),
        },
      ];
    });
    const context = accepted
      .map(
        (record, index) =>
          `[S${index + 1}] ${aliases.get(record.senderId) ?? "Member"} at ${record.createdAt.toISOString()}:\n${redactSecrets(record.content)}`,
      )
      .join("\n\n");
    telemetry?.recordAiContext({
      characters: context.length,
      sources: sources.length,
      task: request.task,
    });
    return { context, sources, truncated: accepted.length < records.length };
  };

  const buildPrompt = async (
    userId: string,
    organizationId: string,
    request: AiResponseRequest,
  ) => {
    if (request.task === AiTask.COMPOSE) {
      return {
        prompt: composeInstruction(request),
        sources: [] as AiWorkspaceSource[],
      };
    }
    const { context, sources, truncated } = await buildContext(
      userId,
      organizationId,
      request,
    );
    if (request.task === AiTask.SUMMARIZE) {
      const instruction =
        request.mode === AiSummaryMode.ACTION_ITEMS
          ? "Extract concrete action items, owners when explicit, and unresolved decisions. Do not invent owners or deadlines."
          : "Summarize the discussion, decisions, unresolved questions, and important context concisely.";
      return {
        sources,
        prompt: `${instruction}\n${truncated ? "Some older messages were omitted because of the context limit.\n" : ""}Cite workspace claims using [S1], [S2], and so on.\n\nWorkspace excerpts:\n${context || "No eligible messages were found."}`,
      };
    }
    const history = (request.history ?? [])
      .map(
        (message) =>
          `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`,
      )
      .join("\n");
    return {
      sources,
      prompt: `Answer the user's question. Use workspace excerpts for organization-specific claims and cite them with [S1], [S2], and so on. If workspace evidence is absent or insufficient, say so, then clearly label any useful general explanation as "General knowledge".\n\n${history ? `Recent assistant history:\n${history}\n\n` : ""}Workspace excerpts:\n${context || "No matching workspace messages were found."}\n\nUser question:\n${request.prompt}`,
    };
  };

  const mapProviderStream = async function* (
    stream: AsyncIterable<AiProviderChunk>,
    input: { startedAt: number; request: AiResponseRequest },
  ) {
    try {
      for await (const chunk of stream) {
        if (chunk.type === "completed" && chunk.usage) {
          telemetry?.recordAiTokens({
            ...chunk.usage,
            task: input.request.task,
          });
        }
        yield chunk;
      }
      telemetry?.recordAiRequest({
        durationSeconds: (Date.now() - input.startedAt) / 1_000,
        task: input.request.task,
        scope:
          input.request.task === AiTask.ASK
            ? input.request.scope.kind
            : "CONVERSATION",
        provider: provider.name,
        model,
        result: "success",
      });
    } catch (error) {
      telemetry?.recordAiRequest({
        durationSeconds: (Date.now() - input.startedAt) / 1_000,
        task: input.request.task,
        scope:
          input.request.task === AiTask.ASK
            ? input.request.scope.kind
            : "CONVERSATION",
        provider: provider.name,
        model,
        result: "failure",
      });
      if (error instanceof AiProviderBlockedError)
        throw new AiResponseBlockedError();
      if (error instanceof AiProviderUnavailableError)
        throw new AiUnavailableError();
      throw error;
    }
  };

  return {
    getSettings: settingsDto,
    updateSettings,
    acceptConsent,
    revokeConsent,
    async createResponse(
      userId: string,
      organizationId: string,
      request: AiResponseRequest,
      signal: AbortSignal,
    ): Promise<AiPreparedResponse> {
      if (provider.name === "disabled")
        throw new AiUnavailableError("The AI assistant is not configured");
      await assertEnabledAndConsented(userId, organizationId);
      const admission = await quota.admit(userId, organizationId);
      if (!admission.allowed) {
        const message =
          admission.reason === "CONCURRENCY"
            ? "The AI assistant is busy. Try again shortly"
            : admission.reason === "USER_DAILY"
              ? `Your daily AI limit of ${dailyUserRequests} requests has been reached`
              : `This workspace's daily AI limit of ${dailyOrganizationRequests} requests has been reached`;
        throw new AiQuotaExceededError(message, admission.retryAfterSeconds);
      }
      const startedAt = Date.now();
      try {
        const prepared = await buildPrompt(userId, organizationId, request);
        const maxOutputTokens =
          request.task === AiTask.COMPOSE
            ? 600
            : request.task === AiTask.SUMMARIZE
              ? 1_200
              : 1_024;
        const providerStream = await provider.streamText(
          {
            task: request.task,
            prompt: prepared.prompt,
            maxOutputTokens,
            temperature: request.task === AiTask.COMPOSE ? 0.35 : 0.2,
          },
          signal,
        );
        return {
          requestId: randomUUID(),
          sources: prepared.sources,
          stream: mapProviderStream(providerStream, { startedAt, request }),
          release: async () => {
            try {
              await quota.release(admission.leaseId);
            } catch (error) {
              logger.error(
                { err: error },
                "AI concurrency lease release failed",
              );
            }
          },
        };
      } catch (error) {
        await quota.release(admission.leaseId).catch(() => undefined);
        if (error instanceof AiProviderBlockedError)
          throw new AiResponseBlockedError();
        if (error instanceof AiProviderUnavailableError)
          throw new AiUnavailableError();
        throw error;
      }
    },
  };
};

export type AiService = ReturnType<typeof createAiService>;
export default createAiService;
