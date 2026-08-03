import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import { Schema, model } from "mongoose";

import type { Conversation } from "./conversation.types.js";

const conversationSchema = new Schema<Conversation>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, select: false },
    type: {
      type: String,
      enum: Object.values(ConversationType),
      default: ConversationType.CHANNEL,
      required: true,
    },
    visibility: {
      type: String,
      enum: Object.values(ConversationVisibility),
      default: ConversationVisibility.PUBLIC,
      required: true,
    },
    position: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

conversationSchema.index(
  { categoryId: 1, nameKey: 1 },
  { name: "unique_conversation_name_per_category", unique: true },
);
conversationSchema.index(
  { organizationId: 1, categoryId: 1, position: 1 },
  { name: "conversations_by_category_position" },
);

const ConversationModel = model<Conversation>(
  "Conversation",
  conversationSchema,
);

export default ConversationModel;
