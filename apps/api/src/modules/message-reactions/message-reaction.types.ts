import type {
  MessageReactionStateDto,
  MessageReactionSummaryDto,
  MessageReactionUsersQuery,
  SetMessageReactionInput,
} from "@intouch/shared/messages";
import type { Types } from "mongoose";

export interface MessageReaction {
  conversationId: Types.ObjectId;
  messageId: Types.ObjectId;
  userId: Types.ObjectId;
  emoji: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageReactionRecord {
  id: string;
  conversationId: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageReactionStateRecord {
  messageId: string;
  reactions: MessageReactionSummaryDto[];
  currentUserReaction: string | null;
}

export interface MessageReactionUserPage {
  records: MessageReactionRecord[];
  total: number;
}

export type {
  MessageReactionStateDto,
  MessageReactionUsersQuery,
  SetMessageReactionInput,
};
