import { Schema, model } from "mongoose";

import type { ConversationReadState } from "./read-receipt.types.js";

const conversationReadStateSchema = new Schema<ConversationReadState>(
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
    lastReadMessageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },
    lastReadAt: { type: Date, required: true },
  },
  { versionKey: false },
);

conversationReadStateSchema.index(
  { conversationId: 1, userId: 1 },
  { name: "unique_conversation_read_receipt", unique: true },
);
conversationReadStateSchema.index(
  { organizationId: 1, conversationId: 1 },
  { name: "read_receipts_by_organization_conversation" },
);

const ConversationReadStateModel = model<ConversationReadState>(
  "ConversationReadState",
  conversationReadStateSchema,
);

export default ConversationReadStateModel;
