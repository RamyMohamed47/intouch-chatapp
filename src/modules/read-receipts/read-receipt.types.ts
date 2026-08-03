import type { Types } from "mongoose";

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
