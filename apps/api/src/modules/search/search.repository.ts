import type { PipelineStage } from "mongoose";
import { Types } from "mongoose";

import ConversationModel from "../conversations/conversation.model.js";
import MessageModel from "../message/message.model.js";
import { UserModel } from "../user/user.model.js";
import {
  createSearchFingerprint,
  decodeSearchCursor,
  encodeSearchCursor,
} from "./search.cursor.js";
import {
  SearchCursorError,
  SearchPersistenceUnavailableError,
} from "./search.errors.js";
import { SEARCH_INDEX_NAMES } from "./search.indexes.js";
import type {
  ChannelSearchRecord,
  DirectConversationPair,
  MessageSearchRecord,
  PersonSearchRecord,
  SearchKind,
  SearchPage,
  SearchProvider,
  SearchRepository,
  SearchRequest,
} from "./search.types.js";

interface RankedDocument {
  _id: Types.ObjectId;
  score: number;
  paginationToken?: string;
}

interface MessageSearchDocument extends RankedDocument {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  createdAt: Date;
}

interface ChannelSearchDocument extends RankedDocument {
  categoryId: Types.ObjectId;
  name: string;
  visibility: ChannelSearchRecord["visibility"];
}

interface PersonSearchDocument extends RankedDocument {
  username: string;
  displayName: string;
  avatarUrl?: string;
}

interface DirectConversationDocument {
  _id: Types.ObjectId;
  directParticipantAId: Types.ObjectId;
  directParticipantBId: Types.ObjectId;
}

const objectIds = (values: readonly string[]) =>
  values.map((value) => new Types.ObjectId(value));

const fuzzy = (query: string) =>
  query.length >= 4 ? { fuzzy: { maxEdits: 1 } } : {};

const nativeCursorStages = (
  cursor: ReturnType<typeof decodeSearchCursor>,
): PipelineStage[] => {
  if (!cursor || cursor.provider !== "native") return [];
  return [
    {
      $match: {
        $or: [
          { score: { $lt: cursor.score } },
          { score: cursor.score, _id: { $lt: new Types.ObjectId(cursor.id) } },
        ],
      },
    },
  ];
};

const paginate = <TDocument extends RankedDocument, TRecord>(
  documents: TDocument[],
  limit: number,
  provider: SearchProvider,
  kind: SearchKind,
  fingerprint: string,
  map: (document: TDocument) => TRecord,
): SearchPage<TRecord> => {
  const hasMore = documents.length > limit;
  const page = hasMore ? documents.slice(0, limit) : documents;
  const last = page.at(-1);
  let nextCursor: string | null = null;
  if (hasMore && last) {
    if (provider === "atlas") {
      if (!last.paginationToken) throw new SearchPersistenceUnavailableError();
      nextCursor = encodeSearchCursor({
        v: 1,
        provider,
        kind,
        fingerprint,
        token: last.paginationToken,
      });
    } else {
      nextCursor = encodeSearchCursor({
        v: 1,
        provider,
        kind,
        fingerprint,
        score: last.score,
        id: last._id.toString(),
      });
    }
  }
  return { records: page.map(map), nextCursor };
};

const withUnavailableMapping = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof SearchCursorError) throw error;
    throw new SearchPersistenceUnavailableError({ cause: error });
  }
};

const createMongooseSearchRepository = (
  provider: SearchProvider,
): SearchRepository => {
  const cursorFor = (kind: SearchKind, input: SearchRequest) => {
    const fingerprint = createSearchFingerprint({
      provider,
      kind,
      query: input.query,
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    });
    return {
      fingerprint,
      cursor: decodeSearchCursor(input.cursor, {
        provider,
        kind,
        fingerprint,
      }),
    };
  };

  return {
    provider,

    async searchMessages(input) {
      if (input.allowedIds.length === 0)
        return { records: [], nextCursor: null };
      return withUnavailableMapping(async () => {
        const kind = "MESSAGES" as const;
        const { cursor, fingerprint } = cursorFor(kind, input);
        const allowedIds = objectIds(input.allowedIds);
        const pipeline: PipelineStage[] =
          provider === "atlas"
            ? ([
                {
                  $search: {
                    index: SEARCH_INDEX_NAMES.messages,
                    ...(cursor?.provider === "atlas"
                      ? { searchAfter: cursor.token }
                      : {}),
                    compound: {
                      must: [
                        {
                          text: {
                            query: input.query,
                            path: "content",
                            ...fuzzy(input.query),
                          },
                        },
                      ],
                      filter: [
                        { in: { path: "conversationId", value: allowedIds } },
                      ],
                    },
                    sort: {
                      score: { $meta: "searchScore" },
                      createdAt: -1,
                      _id: -1,
                    },
                  },
                },
                { $match: { deletedAt: null, content: { $type: "string" } } },
                {
                  $set: {
                    score: { $meta: "searchScore" },
                    paginationToken: { $meta: "searchSequenceToken" },
                  },
                },
                { $limit: input.limit + 1 },
              ] as PipelineStage[])
            : [
                {
                  $match: {
                    $text: { $search: input.query },
                    conversationId: { $in: allowedIds },
                    deletedAt: null,
                    content: { $type: "string" },
                  },
                },
                { $set: { score: { $meta: "textScore" } } },
                ...nativeCursorStages(cursor),
                { $sort: { score: -1, _id: -1 } },
                { $limit: input.limit + 1 },
              ];
        const documents =
          await MessageModel.aggregate<MessageSearchDocument>(pipeline).exec();
        return paginate(
          documents,
          input.limit,
          provider,
          kind,
          fingerprint,
          (document): MessageSearchRecord => ({
            id: document._id.toString(),
            conversationId: document.conversationId.toString(),
            senderId: document.senderId.toString(),
            content: document.content,
            createdAt: document.createdAt,
          }),
        );
      });
    },

    async searchChannels(input) {
      if (input.allowedIds.length === 0)
        return { records: [], nextCursor: null };
      return withUnavailableMapping(async () => {
        const kind = "CHANNELS" as const;
        const { cursor, fingerprint } = cursorFor(kind, input);
        const allowedIds = objectIds(input.allowedIds);
        const pipeline: PipelineStage[] =
          provider === "atlas"
            ? ([
                {
                  $search: {
                    index: SEARCH_INDEX_NAMES.conversations,
                    ...(cursor?.provider === "atlas"
                      ? { searchAfter: cursor.token }
                      : {}),
                    compound: {
                      must: [
                        {
                          autocomplete: {
                            query: input.query,
                            path: "name",
                            ...fuzzy(input.query),
                          },
                        },
                      ],
                      filter: [{ in: { path: "_id", value: allowedIds } }],
                    },
                    sort: {
                      score: { $meta: "searchScore" },
                      _id: -1,
                    },
                  },
                },
                {
                  $set: {
                    score: { $meta: "searchScore" },
                    paginationToken: { $meta: "searchSequenceToken" },
                  },
                },
                { $limit: input.limit + 1 },
              ] as PipelineStage[])
            : [
                {
                  $match: {
                    $text: { $search: input.query },
                    _id: { $in: allowedIds },
                  },
                },
                { $set: { score: { $meta: "textScore" } } },
                ...nativeCursorStages(cursor),
                { $sort: { score: -1, _id: -1 } },
                { $limit: input.limit + 1 },
              ];
        const documents =
          await ConversationModel.aggregate<ChannelSearchDocument>(
            pipeline,
          ).exec();
        return paginate(
          documents,
          input.limit,
          provider,
          kind,
          fingerprint,
          (document): ChannelSearchRecord => ({
            id: document._id.toString(),
            categoryId: document.categoryId.toString(),
            name: document.name,
            visibility: document.visibility,
          }),
        );
      });
    },

    async searchPeople(input) {
      if (input.allowedIds.length === 0)
        return { records: [], nextCursor: null };
      return withUnavailableMapping(async () => {
        const kind = "PEOPLE" as const;
        const { cursor, fingerprint } = cursorFor(kind, input);
        const allowedIds = objectIds(input.allowedIds);
        const pipeline: PipelineStage[] =
          provider === "atlas"
            ? ([
                {
                  $search: {
                    index: SEARCH_INDEX_NAMES.users,
                    ...(cursor?.provider === "atlas"
                      ? { searchAfter: cursor.token }
                      : {}),
                    compound: {
                      should: [
                        {
                          autocomplete: {
                            query: input.query,
                            path: "displayName",
                            ...fuzzy(input.query),
                            score: { boost: { value: 2 } },
                          },
                        },
                        {
                          autocomplete: {
                            query: input.query,
                            path: "username",
                            ...fuzzy(input.query),
                          },
                        },
                      ],
                      minimumShouldMatch: 1,
                      filter: [{ in: { path: "_id", value: allowedIds } }],
                    },
                    sort: {
                      score: { $meta: "searchScore" },
                      _id: -1,
                    },
                  },
                },
                {
                  $set: {
                    score: { $meta: "searchScore" },
                    paginationToken: { $meta: "searchSequenceToken" },
                  },
                },
                { $limit: input.limit + 1 },
              ] as PipelineStage[])
            : [
                {
                  $match: {
                    $text: { $search: input.query },
                    _id: { $in: allowedIds },
                  },
                },
                { $set: { score: { $meta: "textScore" } } },
                ...nativeCursorStages(cursor),
                { $sort: { score: -1, _id: -1 } },
                { $limit: input.limit + 1 },
              ];
        const documents =
          await UserModel.aggregate<PersonSearchDocument>(pipeline).exec();
        return paginate(
          documents,
          input.limit,
          provider,
          kind,
          fingerprint,
          (document): PersonSearchRecord => ({
            id: document._id.toString(),
            username: document.username,
            displayName: document.displayName,
            ...(document.avatarUrl ? { avatarUrl: document.avatarUrl } : {}),
          }),
        );
      });
    },

    async listDirectConversationPairs(organizationId, userId, peerUserIds) {
      return withUnavailableMapping(async () => {
        const peerFilter = peerUserIds ? objectIds(peerUserIds) : undefined;
        const actorId = new Types.ObjectId(userId);
        const query = ConversationModel.find({
          organizationId,
          type: "DIRECT",
          $or: [
            {
              directParticipantAId: actorId,
              ...(peerFilter
                ? { directParticipantBId: { $in: peerFilter } }
                : {}),
            },
            {
              directParticipantBId: actorId,
              ...(peerFilter
                ? { directParticipantAId: { $in: peerFilter } }
                : {}),
            },
          ],
        })
          .select("+directParticipantAId +directParticipantBId")
          .lean<DirectConversationDocument[]>();
        const documents = await query.exec();
        return documents.map((document): DirectConversationPair => ({
          conversationId: document._id.toString(),
          peerUserId: (document.directParticipantAId.equals(actorId)
            ? document.directParticipantBId
            : document.directParticipantAId
          ).toString(),
        }));
      });
    },
  };
};

export default createMongooseSearchRepository;
