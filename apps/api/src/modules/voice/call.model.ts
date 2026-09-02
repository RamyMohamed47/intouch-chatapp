import { Schema, model } from "mongoose";
import { CallEndReason, CallStatus } from "@intouch/shared/voice";

import type { CallSession } from "./voice.types.js";

const callSessionSchema = new Schema<CallSession>(
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
    callerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerRoomId: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    timelineMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    status: {
      type: String,
      enum: Object.values(CallStatus),
      default: CallStatus.RINGING,
      required: true,
    },
    endReason: { type: String, enum: Object.values(CallEndReason) },
    startedAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    answeredAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true },
);

callSessionSchema.index(
  { conversationId: 1, startedAt: -1, _id: -1 },
  { name: "calls_by_conversation" },
);
callSessionSchema.index(
  { callerUserId: 1, status: 1 },
  { name: "active_calls_by_caller" },
);
callSessionSchema.index(
  { recipientUserId: 1, status: 1 },
  { name: "active_calls_by_recipient" },
);
callSessionSchema.index(
  { timelineMessageId: 1 },
  {
    name: "unique_call_timeline_message",
    unique: true,
    partialFilterExpression: { timelineMessageId: { $type: "objectId" } },
  },
);

const CallSessionModel = model<CallSession>("CallSession", callSessionSchema);

export default CallSessionModel;
