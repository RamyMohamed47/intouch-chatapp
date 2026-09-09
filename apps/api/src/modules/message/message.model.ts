import { Schema, model } from "mongoose";

import { MessageType, type Message } from "./message.types.js";

const messageSchema = new Schema<Message>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: null, maxlength: 4_000 },
    messageType: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
      required: true,
    },
    callId: { type: Schema.Types.ObjectId, ref: "CallSession" },
    replyToMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    mentions: {
      type: [
        new Schema(
          {
            userId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            start: { type: Number, min: 0, required: true },
            end: { type: Number, min: 1, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    notifiedMentionUserIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
      select: false,
    },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index(
  { conversationId: 1, _id: -1 },
  { name: "messages_by_conversation_cursor" },
);
messageSchema.index(
  { replyToMessageId: 1 },
  {
    name: "messages_by_reply_target",
    partialFilterExpression: { replyToMessageId: { $type: "objectId" } },
  },
);
messageSchema.index(
  { callId: 1 },
  {
    name: "unique_call_timeline_message",
    unique: true,
    partialFilterExpression: { callId: { $type: "objectId" } },
  },
);
messageSchema.index(
  { content: "text" },
  { name: "messages_content_text", default_language: "none" },
);

const MessageModel = model<Message>("Message", messageSchema);

export default MessageModel;
