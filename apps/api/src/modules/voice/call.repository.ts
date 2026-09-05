import type { ClientSession } from "mongoose";
import { Types } from "mongoose";
import type {
  CallEndReasonValue,
  CallStatusValue,
} from "@intouch/shared/voice";

import CallSessionModel from "./call.model.js";
import type {
  CallSession,
  CallSessionRecord,
  CreateCallSessionRecordInput,
} from "./voice.types.js";

interface CallSessionDocument extends CallSession {
  _id: Types.ObjectId;
}

const toRecord = (call: CallSessionDocument): CallSessionRecord => ({
  id: call._id.toString(),
  organizationId: call.organizationId.toString(),
  conversationId: call.conversationId.toString(),
  callerUserId: call.callerUserId.toString(),
  recipientUserId: call.recipientUserId.toString(),
  mediaMode: call.mediaMode ?? "AUDIO",
  providerRoomId: call.providerRoomId,
  ...(call.timelineMessageId
    ? { timelineMessageId: call.timelineMessageId.toString() }
    : {}),
  status: call.status,
  endReason: call.endReason ?? null,
  startedAt: call.startedAt,
  acceptedAt: call.acceptedAt ?? null,
  answeredAt: call.answeredAt ?? null,
  endedAt: call.endedAt ?? null,
  createdAt: call.createdAt,
  updatedAt: call.updatedAt,
});

export interface CallSessionRepository {
  create(input: CreateCallSessionRecordInput): Promise<CallSessionRecord>;
  findById(callId: string): Promise<CallSessionRecord | null>;
  findByIds(callIds: readonly string[]): Promise<CallSessionRecord[]>;
  findByProviderRoomId(
    providerRoomId: string,
  ): Promise<CallSessionRecord | null>;
  findTimedOutPending(input: {
    connectingAcceptedBefore: Date;
    ringingStartedBefore: Date;
  }): Promise<CallSessionRecord[]>;
  setTimelineMessageId(
    callId: string,
    messageId: string,
  ): Promise<CallSessionRecord | null>;
  transition(
    callId: string,
    from: readonly CallStatusValue[],
    input: {
      status: CallStatusValue;
      endReason?: CallEndReasonValue;
      acceptedAt?: Date;
      answeredAt?: Date;
      endedAt?: Date;
    },
  ): Promise<CallSessionRecord | null>;
  deleteByConversationId(conversationId: string): Promise<number>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
}

const createMongooseCallSessionRepository = (
  session?: ClientSession,
): CallSessionRepository => ({
  async create(input) {
    const calls = await CallSessionModel.create(
      [{ _id: new Types.ObjectId(input.id), ...input, status: "RINGING" }],
      session ? { session } : {},
    );
    const call = calls[0];
    if (!call) throw new Error("Call creation returned no document");
    return toRecord(call.toObject<CallSessionDocument>());
  },
  async findById(callId) {
    const query = CallSessionModel.findById(callId)
      .select("+providerRoomId")
      .lean<CallSessionDocument>();
    if (session) query.session(session);
    const call = await query.exec();
    return call ? toRecord(call) : null;
  },
  async findByIds(callIds) {
    if (callIds.length === 0) return [];
    const query = CallSessionModel.find({ _id: { $in: callIds } })
      .select("+providerRoomId")
      .lean<CallSessionDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toRecord);
  },
  async findByProviderRoomId(providerRoomId) {
    const query = CallSessionModel.findOne({ providerRoomId })
      .select("+providerRoomId")
      .lean<CallSessionDocument>();
    if (session) query.session(session);
    const call = await query.exec();
    return call ? toRecord(call) : null;
  },
  async findTimedOutPending(input) {
    const query = CallSessionModel.find({
      $or: [
        {
          status: "RINGING",
          startedAt: { $lte: input.ringingStartedBefore },
        },
        {
          status: "CONNECTING",
          acceptedAt: { $lte: input.connectingAcceptedBefore },
        },
      ],
    })
      .select("+providerRoomId")
      .lean<CallSessionDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toRecord);
  },
  async setTimelineMessageId(callId, messageId) {
    const query = CallSessionModel.findByIdAndUpdate(
      callId,
      { $set: { timelineMessageId: messageId } },
      { new: true, runValidators: true },
    )
      .select("+providerRoomId")
      .lean<CallSessionDocument>();
    if (session) query.session(session);
    const call = await query.exec();
    return call ? toRecord(call) : null;
  },
  async transition(callId, from, input) {
    const query = CallSessionModel.findOneAndUpdate(
      { _id: callId, status: { $in: from } },
      { $set: input },
      { new: true, runValidators: true },
    )
      .select("+providerRoomId")
      .lean<CallSessionDocument>();
    if (session) query.session(session);
    const call = await query.exec();
    return call ? toRecord(call) : null;
  },
  async deleteByConversationId(conversationId) {
    const query = CallSessionModel.deleteMany({ conversationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },
  async deleteByOrganizationId(organizationId) {
    const query = CallSessionModel.deleteMany({ organizationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },
});

export default createMongooseCallSessionRepository;
