import type { SearchTypeValue } from "@intouch/shared/search";
import type { ConversationVisibilityType } from "@intouch/shared/conversations";

export type SearchProvider = "atlas" | "native";
export type SearchKind = Exclude<SearchTypeValue, "ALL">;

export interface SearchPage<T> {
  records: T[];
  nextCursor: string | null;
}

export interface SearchRequest {
  query: string;
  allowedIds: readonly string[];
  cursor?: string;
  limit: number;
  conversationId?: string;
}

export interface MessageSearchRecord {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

export interface ChannelSearchRecord {
  id: string;
  categoryId: string;
  name: string;
  visibility: ConversationVisibilityType;
}

export interface PersonSearchRecord {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  avatarAssetId?: string | null;
}

export interface DirectConversationPair {
  conversationId: string;
  peerUserId: string;
}

export interface SearchRepository {
  provider: SearchProvider;
  searchMessages(
    input: SearchRequest,
  ): Promise<SearchPage<MessageSearchRecord>>;
  searchChannels(
    input: SearchRequest,
  ): Promise<SearchPage<ChannelSearchRecord>>;
  searchPeople(input: SearchRequest): Promise<SearchPage<PersonSearchRecord>>;
  listDirectConversationPairs(
    organizationId: string,
    userId: string,
    peerUserIds?: readonly string[],
  ): Promise<DirectConversationPair[]>;
}
