import { Types } from "mongoose";

import { PushOutboxModel } from "./push-outbox.model.js";
import type { PushOutboxRecord } from "./push.types.js";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const toRecord = (record: {
  _id: Types.ObjectId;
  notificationId: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  pushVersion: number;
  attempts: number;
  receiptAttempts: number;
  availableAt: Date;
  expiresAt: Date;
  dispatchedAt?: Date;
  leaseUntil?: Date;
  receiptAvailableAt?: Date;
  receiptDispatchedAt?: Date;
  tickets: { deviceId: Types.ObjectId; ticketId: string }[];
}): PushOutboxRecord => ({
  id: record._id.toString(),
  notificationId: record.notificationId.toString(),
  recipientUserId: record.recipientUserId.toString(),
  pushVersion: record.pushVersion,
  attempts: record.attempts,
  receiptAttempts: record.receiptAttempts,
  availableAt: record.availableAt,
  expiresAt: record.expiresAt,
  ...(record.dispatchedAt ? { dispatchedAt: record.dispatchedAt } : {}),
  ...(record.leaseUntil ? { leaseUntil: record.leaseUntil } : {}),
  ...(record.receiptAvailableAt
    ? { receiptAvailableAt: record.receiptAvailableAt }
    : {}),
  ...(record.receiptDispatchedAt
    ? { receiptDispatchedAt: record.receiptDispatchedAt }
    : {}),
  tickets: record.tickets.map(({ deviceId, ticketId }) => ({
    deviceId: deviceId.toString(),
    ticketId,
  })),
});

export interface PushOutboxRepository {
  enqueue(input: {
    notificationId: string;
    recipientUserId: string;
    pushVersion: number;
    now: Date;
  }): Promise<void>;
  listDispatchable(
    now: Date,
    staleBefore: Date,
    limit: number,
  ): Promise<PushOutboxRecord[]>;
  listReceiptReady(
    now: Date,
    staleBefore: Date,
    limit: number,
  ): Promise<PushOutboxRecord[]>;
  claimDispatch(
    id: string,
    now: Date,
    leaseUntil: Date,
  ): Promise<PushOutboxRecord | null>;
  claimReceipt(
    id: string,
    now: Date,
    leaseUntil: Date,
  ): Promise<PushOutboxRecord | null>;
  markDispatched(
    id: string,
    at: Date,
    receiptAt: Date,
    tickets: PushOutboxRecord["tickets"],
  ): Promise<void>;
  markQueued(
    id: string,
    at: Date,
    phase: "DISPATCH" | "RECEIPT",
  ): Promise<void>;
  scheduleDispatchRetry(
    id: string,
    availableAt: Date,
    errorCode: string,
  ): Promise<void>;
  scheduleReceiptRetry(
    id: string,
    availableAt: Date,
    errorCode: string,
  ): Promise<void>;
  markComplete(id: string, at: Date): Promise<void>;
  markFailed(id: string, at: Date, errorCode: string): Promise<void>;
}

export const createMongoosePushOutboxRepository = (): PushOutboxRepository => ({
  async enqueue(input) {
    await PushOutboxModel.updateOne(
      {
        notificationId: input.notificationId,
        pushVersion: input.pushVersion,
      },
      {
        $setOnInsert: {
          ...input,
          status: "PENDING",
          attempts: 0,
          receiptAttempts: 0,
          availableAt: input.now,
          expiresAt: new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
          tickets: [],
        },
      },
      { upsert: true },
    ).exec();
  },
  async listDispatchable(now, staleBefore, limit) {
    return (
      await PushOutboxModel.find({
        expiresAt: { $gt: now },
        $and: [
          {
            $or: [
              { status: "PENDING", availableAt: { $lte: now } },
              { status: "SENDING", leaseUntil: { $lte: now } },
            ],
          },
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
  async listReceiptReady(now, staleBefore, limit) {
    return (
      await PushOutboxModel.find({
        expiresAt: { $gt: now },
        receiptAvailableAt: { $lte: now },
        $and: [
          {
            $or: [
              { status: "WAITING_RECEIPT" },
              { status: "CHECKING_RECEIPT", leaseUntil: { $lte: now } },
            ],
          },
          {
            $or: [
              { receiptDispatchedAt: { $exists: false } },
              { receiptDispatchedAt: { $lte: staleBefore } },
            ],
          },
        ],
      })
        .sort({ receiptAvailableAt: 1, _id: 1 })
        .limit(limit)
        .lean()
        .exec()
    ).map(toRecord);
  },
  async claimDispatch(id, now, leaseUntil) {
    if (!Types.ObjectId.isValid(id)) return null;
    const record = await PushOutboxModel.findOneAndUpdate(
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
  async claimReceipt(id, now, leaseUntil) {
    if (!Types.ObjectId.isValid(id)) return null;
    const record = await PushOutboxModel.findOneAndUpdate(
      {
        _id: id,
        expiresAt: { $gt: now },
        receiptAvailableAt: { $lte: now },
        $or: [
          { status: "WAITING_RECEIPT" },
          { status: "CHECKING_RECEIPT", leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { status: "CHECKING_RECEIPT", leaseUntil },
        $inc: { receiptAttempts: 1 },
        $unset: { receiptDispatchedAt: 1 },
      },
      { new: true },
    )
      .lean()
      .exec();
    return record ? toRecord(record) : null;
  },
  async markDispatched(id, at, receiptAt, tickets) {
    const hasTickets = tickets.length > 0;
    await PushOutboxModel.updateOne(
      { _id: id, status: "SENDING" },
      {
        $set: {
          status: hasTickets ? "WAITING_RECEIPT" : "COMPLETE",
          tickets,
          ...(hasTickets
            ? { receiptAvailableAt: receiptAt }
            : { purgeAt: new Date(at.getTime() + RETENTION_MS) }),
        },
        $unset: {
          leaseUntil: 1,
          lastError: 1,
          ...(hasTickets ? { purgeAt: 1 } : { receiptAvailableAt: 1 }),
        },
      },
    ).exec();
  },
  async markQueued(id, at, phase) {
    await PushOutboxModel.updateOne(
      { _id: id },
      {
        $set:
          phase === "DISPATCH"
            ? { dispatchedAt: at }
            : { receiptDispatchedAt: at },
      },
    ).exec();
  },
  async scheduleDispatchRetry(id, availableAt, errorCode) {
    await PushOutboxModel.updateOne(
      { _id: id, status: "SENDING" },
      {
        $set: { status: "PENDING", availableAt, lastError: errorCode },
        $unset: { leaseUntil: 1, dispatchedAt: 1 },
      },
    ).exec();
  },
  async scheduleReceiptRetry(id, availableAt, errorCode) {
    await PushOutboxModel.updateOne(
      { _id: id, status: "CHECKING_RECEIPT" },
      {
        $set: {
          status: "WAITING_RECEIPT",
          receiptAvailableAt: availableAt,
          lastError: errorCode,
        },
        $unset: { leaseUntil: 1, receiptDispatchedAt: 1 },
      },
    ).exec();
  },
  async markComplete(id, at) {
    await PushOutboxModel.updateOne(
      { _id: id },
      {
        $set: {
          status: "COMPLETE",
          purgeAt: new Date(at.getTime() + RETENTION_MS),
        },
        $unset: {
          leaseUntil: 1,
          lastError: 1,
          dispatchedAt: 1,
          receiptDispatchedAt: 1,
        },
      },
    ).exec();
  },
  async markFailed(id, at, errorCode) {
    await PushOutboxModel.updateOne(
      { _id: id },
      {
        $set: {
          status: "FAILED",
          lastError: errorCode,
          purgeAt: new Date(at.getTime() + RETENTION_MS),
        },
        $unset: { leaseUntil: 1, dispatchedAt: 1, receiptDispatchedAt: 1 },
      },
    ).exec();
  },
});
