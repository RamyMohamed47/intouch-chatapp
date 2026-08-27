import type {
  CreateMessageInput,
  MessageHistoryQuery,
  MessageReactionSummaryDto,
  UpdateMessageInput,
} from "@intouch/shared/messages";
import { MessageType, type MessageTypeValue } from "@intouch/shared/messages";
import type { Types } from "mongoose";

export { MessageType };
export type { MessageTypeValue };

export interface Message {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string | null;
  messageType: MessageTypeValue;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  messageType: MessageTypeValue;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMessageRecordInput {
  conversationId: string;
  senderId: string;
  content: string;
  messageType: MessageTypeValue;
}

export interface MessagePage {
  messages: Array<
    MessageRecord & {
      reactions: MessageReactionSummaryDto[];
      currentUserReaction: string | null;
    }
  >;
  nextCursor: string | null;
}

export type { CreateMessageInput, MessageHistoryQuery, UpdateMessageInput };
