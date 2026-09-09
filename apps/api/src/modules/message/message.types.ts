import type {
  CreateMessageInput,
  MessageHistoryQuery,
  MessageReactionSummaryDto,
  MessageMention,
  MessageReplyPreviewDto,
  UpdateMessageInput,
} from "@intouch/shared/messages";
import { MessageType, type MessageTypeValue } from "@intouch/shared/messages";
import type { AttachmentDto } from "@intouch/shared/uploads";
import type { CallSummaryDto } from "@intouch/shared/voice";
import type { Types } from "mongoose";

export { MessageType };
export type { MessageTypeValue };

export interface Message {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string | null;
  messageType: MessageTypeValue;
  callId?: Types.ObjectId;
  replyToMessageId?: Types.ObjectId;
  mentions: Array<{
    userId: Types.ObjectId;
    start: number;
    end: number;
  }>;
  notifiedMentionUserIds: Types.ObjectId[];
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
  callId?: string;
  replyToMessageId?: string;
  mentions?: MessageMention[];
  notifiedMentionUserIds?: string[];
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: AttachmentDto[];
  call?: CallSummaryDto | null;
  replyTo?: MessageReplyPreviewDto | null;
}

export interface CreateMessageRecordInput {
  conversationId: string;
  senderId: string;
  content: string | null;
  messageType: MessageTypeValue;
  callId?: string;
  replyToMessageId?: string;
  mentions?: MessageMention[];
  notifiedMentionUserIds?: string[];
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
