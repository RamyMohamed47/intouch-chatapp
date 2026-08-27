import { Schema, model } from "mongoose";

import type { MessageReaction } from "./message-reaction.types.js";

const messageReactionSchema = new Schema<MessageReaction>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxlength: 32 },
  },
  { timestamps: true },
);

messageReactionSchema.index(
  { messageId: 1, userId: 1 },
  { name: "unique_message_user_reaction", unique: true },
);
messageReactionSchema.index(
  { conversationId: 1, messageId: 1, emoji: 1 },
  { name: "reactions_by_conversation_message_emoji" },
);
messageReactionSchema.index(
  { messageId: 1, emoji: 1, _id: 1 },
  { name: "reaction_users_by_message_emoji" },
);

const MessageReactionModel = model<MessageReaction>(
  "MessageReaction",
  messageReactionSchema,
);

export default MessageReactionModel;
