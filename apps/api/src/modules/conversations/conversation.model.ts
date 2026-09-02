import {
  ChannelKind,
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
      required(this: Conversation) {
        return this.type === ConversationType.CHANNEL;
      },
    },
    kind: {
      type: String,
      enum: Object.values(ChannelKind),
      default: ChannelKind.TEXT,
      required(this: Conversation) {
        return this.type === ConversationType.CHANNEL;
      },
    },
    voiceRoomId: {
      type: String,
      required(this: Conversation) {
        return (
          this.type === ConversationType.CHANNEL &&
          this.kind === ChannelKind.VOICE
        );
      },
      select: false,
    },
    name: {
      type: String,
      required(this: Conversation) {
        return this.type === ConversationType.CHANNEL;
      },
      trim: true,
      maxlength: 100,
    },
    nameKey: {
      type: String,
      required(this: Conversation) {
        return this.type === ConversationType.CHANNEL;
      },
      select: false,
    },
    type: {
      type: String,
      enum: Object.values(ConversationType),
      default: ConversationType.CHANNEL,
      required: true,
    },
    visibility: {
      type: String,
      enum: Object.values(ConversationVisibility),
      required(this: Conversation) {
        return this.type === ConversationType.CHANNEL;
      },
    },
    position: {
      type: Number,
      required(this: Conversation) {
        return this.type === ConversationType.CHANNEL;
      },
      min: 0,
    },
    directParticipantKey: {
      type: String,
      required(this: Conversation) {
        return this.type === ConversationType.DIRECT;
      },
      select: false,
    },
    directParticipantAId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required(this: Conversation) {
        return this.type === ConversationType.DIRECT;
      },
      select: false,
    },
    directParticipantBId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required(this: Conversation) {
        return this.type === ConversationType.DIRECT;
      },
      select: false,
    },
    activityAt: {
      type: Date,
      default: Date.now,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

conversationSchema.index(
  { categoryId: 1, nameKey: 1 },
  {
    name: "unique_channel_name_per_category",
    unique: true,
    partialFilterExpression: { type: ConversationType.CHANNEL },
  },
);
conversationSchema.index(
  { voiceRoomId: 1 },
  {
    name: "unique_voice_room_id",
    unique: true,
    partialFilterExpression: { voiceRoomId: { $type: "string" } },
  },
);
conversationSchema.index(
  {
    organizationId: 1,
    type: 1,
    directParticipantAId: 1,
    activityAt: -1,
    _id: -1,
  },
  {
    name: "direct_conversations_by_first_participant_activity",
    partialFilterExpression: { type: ConversationType.DIRECT },
  },
);
conversationSchema.index(
  {
    organizationId: 1,
    type: 1,
    directParticipantBId: 1,
    activityAt: -1,
    _id: -1,
  },
  {
    name: "direct_conversations_by_second_participant_activity",
    partialFilterExpression: { type: ConversationType.DIRECT },
  },
);
conversationSchema.index(
  { organizationId: 1, categoryId: 1, position: 1 },
  {
    name: "channels_by_category_position",
    partialFilterExpression: { type: ConversationType.CHANNEL },
  },
);
conversationSchema.index(
  { organizationId: 1, type: 1, directParticipantKey: 1 },
  {
    name: "unique_direct_conversation_pair",
    unique: true,
    partialFilterExpression: { type: ConversationType.DIRECT },
  },
);
conversationSchema.index(
  { name: "text" },
  { name: "channel_name_text", default_language: "none" },
);

const ConversationModel = model<Conversation>(
  "Conversation",
  conversationSchema,
);

export default ConversationModel;
