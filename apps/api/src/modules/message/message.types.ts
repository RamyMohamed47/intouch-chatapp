import type {
  CreateMessageInput,
  MessageHistoryQuery,
  MessageReactionSummaryDto,
  UpdateMessageInput,
} from "@intouch/shared/messages";
import { MessageType, type MessageTypeValue } from "@intouch/shared/messages";
import type { AttachmentDto } from "@intouch/shared/uploads";
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
  attachments: AttachmentDto[];
}

export interface CreateMessageRecordInput {
  conversationId: string;
  senderId: string;
  content: string | null;
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

export interface MessageContextRecords {
  messages: MessageRecord[];
  hasEarlier: boolean;
  hasLater: boolean;
}

export type { CreateMessageInput, MessageHistoryQuery, UpdateMessageInput };
