import {
  CallAlertOutboxModel,
  type CallAlertKindValue,
} from "./call-alert.model.js";

export interface CallAlertOutboxRecord {
  id: string;
  callId: string;
  recipientUserId: string;
  kind: CallAlertKindValue;
  attempts: number;
  availableAt: Date;
  expiresAt: Date;
}

const toRecord = (record: {
  _id: { toString(): string };
  callId: string;
  recipientUserId: { toString(): string };
  kind: CallAlertKindValue;
  attempts: number;
  availableAt: Date;
  expiresAt: Date;
}): CallAlertOutboxRecord => ({
  id: record._id.toString(),
  callId: record.callId,
  recipientUserId: record.recipientUserId.toString(),
  kind: record.kind,
  attempts: record.attempts,
  availableAt: record.availableAt,
  expiresAt: record.expiresAt,
});

export interface CallAlertOutboxRepository {
  enqueue(input: {
    callId: string;
    recipientUserId: string;
    kind: CallAlertKindValue;
    now: Date;
    expiresAt: Date;
  }): Promise<void>;
  listDispatchable(
    now: Date,
    staleBefore: Date,
    limit: number,
  ): Promise<CallAlertOutboxRecord[]>;
  claim(
    id: string,
    now: Date,
    leaseUntil: Date,
  ): Promise<CallAlertOutboxRecord | null>;
  markComplete(id: string, now: Date): Promise<void>;
  markQueued(id: string, now: Date): Promise<void>;
  scheduleRetry(
    id: string,
    availableAt: Date,
    errorCode: string,
  ): Promise<void>;
  markFailed(id: string, now: Date, errorCode: string): Promise<void>;
}

const RETENTION_MS = 24 * 60 * 60 * 1000;

export const createMongooseCallAlertOutboxRepository =
  (): CallAlertOutboxRepository => ({
    async enqueue(input) {
      await CallAlertOutboxModel.updateOne(
        {
          callId: input.callId,
          recipientUserId: input.recipientUserId,
          kind: input.kind,
        },
        {
          $setOnInsert: {
            ...input,
            status: "PENDING",
            attempts: 0,
            availableAt: input.now,
          },
        },
        { upsert: true },
      ).exec();
    },

    async listDispatchable(now, staleBefore, limit) {
      return (
        await CallAlertOutboxModel.find({
          expiresAt: { $gt: now },
          $or: [
            { status: "PENDING", availableAt: { $lte: now } },
            { status: "SENDING", leaseUntil: { $lte: now } },
          ],
          $and: [
            {
              $or: [
                { dispatchedAt: { $exists: false } },
                { dispatchedAt: { $lte: staleBefore } },
              ],
            },
          ],
        })
          .sort({ availableAt: 1, _id: 1 })
          .limit(limit)
          .lean()
          .exec()
      ).map(toRecord);
    },

    async claim(id, now, leaseUntil) {
      const record = await CallAlertOutboxModel.findOneAndUpdate(
        {
          _id: id,
          expiresAt: { $gt: now },
          $or: [
            { status: "PENDING", availableAt: { $lte: now } },
            { status: "SENDING", leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: { status: "SENDING", leaseUntil },
          $inc: { attempts: 1 },
          $unset: { dispatchedAt: 1 },
        },
        { new: true },
      )
        .lean()
        .exec();
      return record ? toRecord(record) : null;
    },

    async markComplete(id, now) {
      await CallAlertOutboxModel.updateOne(
        { _id: id },
        {
          $set: {
            status: "COMPLETE",
            purgeAt: new Date(now.getTime() + RETENTION_MS),
          },
          $unset: { leaseUntil: 1, dispatchedAt: 1, lastError: 1 },
        },
      ).exec();
    },

    async markQueued(id, now) {
      await CallAlertOutboxModel.updateOne(
        { _id: id },
        { $set: { dispatchedAt: now } },
      ).exec();
    },

    async scheduleRetry(id, availableAt, errorCode) {
      await CallAlertOutboxModel.updateOne(
        { _id: id, status: "SENDING" },
        {
          $set: { status: "PENDING", availableAt, lastError: errorCode },
          $unset: { leaseUntil: 1, dispatchedAt: 1 },
        },
      ).exec();
    },

    async markFailed(id, now, errorCode) {
      await CallAlertOutboxModel.updateOne(
        { _id: id },
        {
          $set: {
            status: "FAILED",
            lastError: errorCode,
            purgeAt: new Date(now.getTime() + RETENTION_MS),
          },
          $unset: { leaseUntil: 1, dispatchedAt: 1 },
        },
      ).exec();
    },
  });
