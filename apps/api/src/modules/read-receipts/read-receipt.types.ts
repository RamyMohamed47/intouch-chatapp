import type { Types } from "mongoose";
import type { PublicUser } from "../user/user.types.js";

export interface ConversationReadState {
  organizationId: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  lastReadMessageId: Types.ObjectId;
  lastReadAt: Date;
}

export interface ConversationReadStateRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: Date;
}

export interface AdvanceConversationReadStateInput {
  organizationId: string;
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: Date;
}

export interface AdvanceConversationReadStateResult {
  readState: ConversationReadStateRecord;
  advanced: boolean;
}

export interface SummarizeMessageReadersInput {
  organizationId: string;
  conversationId: string;
  messageId: string;
  senderId: string;
  requireParticipant: boolean;
}

export interface MessageReadReceiptSummaryRecord {
  messageId: string;
  readByCount: number;
  readers: Array<
    Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">
  >;
}
