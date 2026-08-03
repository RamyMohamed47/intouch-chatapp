import { Schema, model } from "mongoose";

import type { ConversationParticipant } from "./conversation.types.js";

const conversationParticipantSchema = new Schema<ConversationParticipant>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    addedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    joinedAt: { type: Date, default: Date.now, required: true },
  },
  { versionKey: false },
);

conversationParticipantSchema.index(
  { conversationId: 1, userId: 1 },
  { name: "unique_conversation_participant", unique: true },
);
conversationParticipantSchema.index(
  { userId: 1, conversationId: 1 },
  { name: "conversations_by_participant" },
);
conversationParticipantSchema.index(
  { organizationId: 1 },
  { name: "participants_by_organization" },
);

const ConversationParticipantModel = model<ConversationParticipant>(
  "ConversationParticipant",
  conversationParticipantSchema,
);

export default ConversationParticipantModel;
