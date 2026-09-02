import {
  type ChannelKindValue,
  ConversationType,
  type ConversationTypeValue,
  type ConversationVisibilityType,
  type CreateConversationInput,
  type UpdateConversationInput,
} from "@intouch/shared/conversations";
import type { VoiceOccupancyDto } from "@intouch/shared/voice";
import type { Types } from "mongoose";
import type { MembershipRole } from "../memberships/index.js";
import type { PublicUser } from "../user/user.types.js";
import type { MessageRecord } from "../message/message.types.js";
import type { PresenceStatusValue } from "../presence/presence.types.js";

export interface Conversation {
  organizationId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  kind?: ChannelKindValue;
  voiceRoomId?: string;
  name?: string;
  nameKey?: string;
  type: ConversationTypeValue;
  visibility?: ConversationVisibilityType;
  position?: number;
  directParticipantKey?: string;
  directParticipantAId?: Types.ObjectId;
  directParticipantBId?: Types.ObjectId;
  activityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationRecord {
  id: string;
  organizationId: string;
  categoryId?: string;
  kind?: ChannelKindValue;
  voiceRoomId?: string;
  name?: string;
  type: ConversationTypeValue;
  visibility?: ConversationVisibilityType;
  position?: number;
  directParticipantKey?: string;
  activityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ChannelConversationRecord = ConversationRecord & {
  type: typeof ConversationType.CHANNEL;
  kind: ChannelKindValue;
  categoryId: string;
  name: string;
  visibility: ConversationVisibilityType;
  position: number;
  voiceRoomId?: string;
};

export type DirectConversationRecord = ConversationRecord & {
  type: typeof ConversationType.DIRECT;
  directParticipantKey: string;
};

export const isChannelConversation = (
  conversation: ConversationRecord,
): conversation is ChannelConversationRecord =>
  conversation.type === "CHANNEL" &&
  conversation.kind !== undefined &&
  conversation.categoryId !== undefined &&
  conversation.name !== undefined &&
  conversation.visibility !== undefined &&
  conversation.position !== undefined;

export const isDirectConversation = (
  conversation: ConversationRecord,
): conversation is DirectConversationRecord =>
  conversation.type === "DIRECT" &&
  conversation.directParticipantKey !== undefined;

export interface CreateChannelConversationRecordInput {
  organizationId: string;
  categoryId: string;
  name: string;
  nameKey: string;
  type: ConversationTypeValue;
  kind: ChannelKindValue;
  voiceRoomId?: string;
  visibility: ConversationVisibilityType;
  position: number;
}

export interface CreateDirectConversationRecordInput {
  organizationId: string;
  type: typeof ConversationType.DIRECT;
  directParticipantKey: string;
  directParticipantAId: string;
  directParticipantBId: string;
}

export type CreateConversationRecordInput =
  CreateChannelConversationRecordInput | CreateDirectConversationRecordInput;

export interface UpdateConversationRecordInput {
  categoryId?: string;
  name?: string;
  nameKey?: string;
  visibility?: ConversationVisibilityType;
  position?: number;
}

export interface ConversationParticipant {
  organizationId: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  addedByUserId: Types.ObjectId;
  joinedAt: Date;
}

export interface ConversationParticipantRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  userId: string;
  addedByUserId: string;
  joinedAt: Date;
}

export interface ConversationParticipantView extends ConversationParticipantRecord {
  user: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">;
}

export interface OrganizationMemberView {
  membershipId: string;
  role: MembershipRole;
  joinedAt: Date;
  user: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl"> & {
    status: PresenceStatusValue;
    lastSeenAt: Date | null;
  };
}

export interface ReadReceiptView {
  id: string;
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: Date;
}

export interface ConversationSummary extends ConversationRecord {
  lastMessage?: MessageRecord | null;
  unreadCount?: number;
  readReceipt?: ReadReceiptView | null;
  peerReadReceipt?: ReadReceiptView | null;
  peer?: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">;
  occupancy?: VoiceOccupancyDto;
}

export type { CreateConversationInput, UpdateConversationInput };
