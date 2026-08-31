import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import {
  SearchType,
  type OrganizationSearchQuery,
  type OrganizationSearchResultDto,
  type SearchHighlightSegmentDto,
} from "@intouch/shared/search";
import type { Logger } from "pino";

import type {
  ConversationParticipantRepository,
  ConversationRepository,
} from "../conversations/index.js";
import { ConversationNotFoundError } from "../conversations/conversation.errors.js";
import type { MembershipService } from "../memberships/index.js";
import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import type { OrganizationRepository } from "../organizations/organization.repository.js";
import type { PresenceService } from "../presence/index.js";
import type { UserRepository } from "../user/user.repository.js";
import {
  SearchPersistenceUnavailableError,
  SearchUnavailableError,
} from "./search.errors.js";
import type {
  ChannelSearchRecord,
  MessageSearchRecord,
  PersonSearchRecord,
  SearchPage,
  SearchRepository,
} from "./search.types.js";

const SNIPPET_LENGTH = 180;

const createSnippet = (
  content: string,
  query: string,
): SearchHighlightSegmentDto[] => {
  const terms = query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const normalized = content.toLocaleLowerCase();
  const match = terms
    .map((term) => ({ term, index: normalized.indexOf(term) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  const center = match?.index ?? 0;
  const start = Math.max(0, center - Math.floor(SNIPPET_LENGTH / 3));
  const end = Math.min(content.length, start + SNIPPET_LENGTH);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  const excerpt = `${prefix}${content.slice(start, end)}${suffix}`;
  if (!match) return [{ text: excerpt, matched: false }];
  const adjustedIndex = prefix.length + match.index - start;
  const adjustedEnd = adjustedIndex + match.term.length;
  return [
    ...(adjustedIndex > 0
      ? [{ text: excerpt.slice(0, adjustedIndex), matched: false }]
      : []),
    { text: excerpt.slice(adjustedIndex, adjustedEnd), matched: true },
    ...(adjustedEnd < excerpt.length
      ? [{ text: excerpt.slice(adjustedEnd), matched: false }]
      : []),
  ];
};

export interface SearchServiceDependencies {
  conversations: ConversationRepository;
  logger: Logger;
  memberships: MembershipService;
  organizationPolicy: OrganizationPolicy;
  organizations: OrganizationRepository;
  participants: ConversationParticipantRepository;
  presence: Pick<PresenceService, "getMany">;
  repository: SearchRepository;
  telemetry?: {
    recordProviderOperation(input: {
      durationSeconds: number;
      operation: string;
      provider: string;
      result: "success" | "failure";
    }): void;
  };
  users: Pick<UserRepository, "findPublicByIds">;
}

const createSearchService = ({
  conversations,
  logger,
  memberships,
  organizationPolicy,
  organizations,
  participants,
  presence,
  repository,
  telemetry,
  users,
}: SearchServiceDependencies) => {
  const getScope = async (userId: string, organizationId: string) => {
    const [organization, membership] = await Promise.all([
      organizations.findById(organizationId),
      memberships.findForUser(userId, organizationId),
    ]);
    organizationPolicy.assertMember(organization, membership);
    const [channels, participantIds, organizationMemberships] =
      await Promise.all([
        conversations.listByOrganization(organizationId),
        participants.listConversationIdsForUserInOrganization(
          userId,
          organizationId,
        ),
        memberships.listForOrganization(organizationId),
      ]);
    const participantSet = new Set(participantIds);
    const accessibleChannels = channels.filter(
      (conversation) =>
        conversation.visibility === ConversationVisibility.PUBLIC ||
        participantSet.has(conversation.id),
    );
    const directConversationIds = participantIds.filter(
      (conversationId) =>
        !accessibleChannels.some(({ id }) => id === conversationId),
    );
    const directConversations = await conversations.findByIds(
      directConversationIds,
      ConversationType.DIRECT,
    );
    return {
      accessibleChannels,
      directConversations,
      memberships: organizationMemberships.filter(
        ({ userId: memberId }) => memberId !== userId,
      ),
    };
  };

  const messageResults = async (
    userId: string,
    organizationId: string,
    query: OrganizationSearchQuery,
    scope: Awaited<ReturnType<typeof getScope>>,
    limit: number,
  ): Promise<SearchPage<OrganizationSearchResultDto>> => {
    const allConversationIds = [
      ...scope.accessibleChannels.map(({ id }) => id),
      ...scope.directConversations.map(({ id }) => id),
    ];
    if (
      query.conversationId &&
      !allConversationIds.includes(query.conversationId)
    ) {
      throw new ConversationNotFoundError();
    }
    const allowedIds = query.conversationId
      ? [query.conversationId]
      : allConversationIds;
    const page = await repository.searchMessages({
      query: query.q,
      allowedIds,
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.conversationId ? { conversationId: query.conversationId } : {}),
    });
    const senderIds = [
      ...new Set(page.records.map(({ senderId }) => senderId)),
    ];
    const directIds = new Set(scope.directConversations.map(({ id }) => id));
    const pairs = await repository.listDirectConversationPairs(
      organizationId,
      userId,
    );
    const peerIds = pairs
      .filter(({ conversationId }) => directIds.has(conversationId))
      .map(({ peerUserId }) => peerUserId);
    const publicUsers = await users.findPublicByIds([
      ...new Set([...senderIds, ...peerIds]),
    ]);
    const usersById = new Map(publicUsers.map((user) => [user.id, user]));
    const channelsById = new Map(
      scope.accessibleChannels.map((conversation) => [
        conversation.id,
        conversation,
      ]),
    );
    const peersByConversationId = new Map(
      pairs.map((pair) => [pair.conversationId, pair.peerUserId]),
    );
    const records = page.records.flatMap(
      (record: MessageSearchRecord): OrganizationSearchResultDto[] => {
        const sender = usersById.get(record.senderId);
        if (!sender) return [];
        const channel = channelsById.get(record.conversationId);
        const peerId = peersByConversationId.get(record.conversationId);
        const peer = peerId ? usersById.get(peerId) : undefined;
        if (!channel && !peer) return [];
        return [
          {
            kind: "MESSAGE",
            id: record.id,
            conversation: channel
              ? {
                  id: channel.id,
                  type: ConversationType.CHANNEL,
                  label: channel.name ?? "Channel",
                }
              : {
                  id: record.conversationId,
                  type: ConversationType.DIRECT,
                  label: peer?.displayName ?? "Direct message",
                },
            sender: {
              id: sender.id,
              username: sender.username,
              displayName: sender.displayName,
              avatarAssetId: sender.avatarAssetId ?? null,
              ...(sender.avatarUrl ? { avatarUrl: sender.avatarUrl } : {}),
            },
            snippet: createSnippet(record.content, query.q),
            createdAt: record.createdAt.toISOString(),
          },
        ];
      },
    );
    return { records, nextCursor: page.nextCursor };
  };

  const channelResults = async (
    query: OrganizationSearchQuery,
    scope: Awaited<ReturnType<typeof getScope>>,
    limit: number,
  ): Promise<SearchPage<OrganizationSearchResultDto>> => {
    const page = await repository.searchChannels({
      query: query.q,
      allowedIds: scope.accessibleChannels.map(({ id }) => id),
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    return {
      records: page.records.map(
        (record: ChannelSearchRecord): OrganizationSearchResultDto => ({
          kind: "CHANNEL",
          id: record.id,
          categoryId: record.categoryId,
          name: record.name,
          visibility: record.visibility,
        }),
      ),
      nextCursor: page.nextCursor,
    };
  };

  const peopleResults = async (
    userId: string,
    organizationId: string,
    query: OrganizationSearchQuery,
    scope: Awaited<ReturnType<typeof getScope>>,
    limit: number,
  ): Promise<SearchPage<OrganizationSearchResultDto>> => {
    const page = await repository.searchPeople({
      query: query.q,
      allowedIds: scope.memberships.map(({ userId: memberId }) => memberId),
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    const membershipByUserId = new Map(
      scope.memberships.map((membership) => [membership.userId, membership]),
    );
    const [presenceRecords, directPairs] = await Promise.all([
      presence.getMany(page.records.map(({ id }) => id)),
      repository.listDirectConversationPairs(
        organizationId,
        userId,
        page.records.map(({ id }) => id),
      ),
    ]);
    const presenceById = new Map(
      presenceRecords.map((record) => [record.userId, record]),
    );
    const directByPeerId = new Map(
      directPairs.map((pair) => [pair.peerUserId, pair.conversationId]),
    );
    return {
      records: page.records.flatMap(
        (record: PersonSearchRecord): OrganizationSearchResultDto[] => {
          const membership = membershipByUserId.get(record.id);
          const memberPresence = presenceById.get(record.id);
          if (!membership || !memberPresence) return [];
          return [
            {
              kind: "PERSON",
              membershipId: membership.id,
              role: membership.role,
              user: {
                id: record.id,
                username: record.username,
                displayName: record.displayName,
                avatarAssetId: record.avatarAssetId ?? null,
                ...(record.avatarUrl ? { avatarUrl: record.avatarUrl } : {}),
                status: memberPresence.status,
                lastSeenAt: memberPresence.lastSeenAt?.toISOString() ?? null,
              },
              directConversationId: directByPeerId.get(record.id) ?? null,
            },
          ];
        },
      ),
      nextCursor: page.nextCursor,
    };
  };

  return {
    async search(
      userId: string,
      organizationId: string,
      query: OrganizationSearchQuery,
    ) {
      const startedAt = performance.now();
      try {
        const scope = await getScope(userId, organizationId);
        const limit = query.type === SearchType.ALL ? 5 : query.limit;
        let results: OrganizationSearchResultDto[] = [];
        let nextCursor: string | null = null;
        if (query.type === SearchType.ALL) {
          const [messagesPage, channelsPage, peoplePage] = await Promise.all([
            messageResults(userId, organizationId, query, scope, limit),
            channelResults(query, scope, limit),
            peopleResults(userId, organizationId, query, scope, limit),
          ]);
          results = [
            ...messagesPage.records,
            ...channelsPage.records,
            ...peoplePage.records,
          ];
        } else if (query.type === SearchType.MESSAGES) {
          const page = await messageResults(
            userId,
            organizationId,
            query,
            scope,
            limit,
          );
          results = page.records;
          nextCursor = page.nextCursor;
        } else if (query.type === SearchType.CHANNELS) {
          const page = await channelResults(query, scope, limit);
          results = page.records;
          nextCursor = page.nextCursor;
        } else {
          const page = await peopleResults(
            userId,
            organizationId,
            query,
            scope,
            limit,
          );
          results = page.records;
          nextCursor = page.nextCursor;
        }
        logger.info(
          {
            provider: repository.provider,
            searchType: query.type,
            durationMs: Math.round(performance.now() - startedAt),
            resultCount: results.length,
            userId,
            organizationId,
          },
          "Organization search completed",
        );
        telemetry?.recordProviderOperation({
          durationSeconds: (performance.now() - startedAt) / 1_000,
          operation: "search.execute",
          provider: repository.provider,
          result: "success",
        });
        return { query: query.q, type: query.type, results, nextCursor };
      } catch (error) {
        telemetry?.recordProviderOperation({
          durationSeconds: (performance.now() - startedAt) / 1_000,
          operation: "search.execute",
          provider: repository.provider,
          result: "failure",
        });
        if (error instanceof SearchPersistenceUnavailableError) {
          logger.error(
            {
              provider: repository.provider,
              searchType: query.type,
              durationMs: Math.round(performance.now() - startedAt),
              resultCount: 0,
              userId,
              organizationId,
            },
            "Organization search provider failed",
          );
          throw new SearchUnavailableError();
        }
        throw error;
      }
    },
  };
};

export type SearchService = ReturnType<typeof createSearchService>;
export default createSearchService;
export { createSnippet };
