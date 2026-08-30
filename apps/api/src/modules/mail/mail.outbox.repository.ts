import { Types, type ClientSession } from "mongoose";

import { MailOutboxModel } from "./mail.outbox.model.js";
import type { CreateMailOutboxInput, MailOutboxRecord } from "./mail.types.js";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface MailOutboxRepository {
  enqueue(input: CreateMailOutboxInput): Promise<void>;
  cancel(aggregateKey: string): Promise<void>;
  cancelByPrefix(prefix: string): Promise<void>;
  claimNext(now: Date, leaseUntil: Date): Promise<MailOutboxRecord | null>;
  claimById(
    id: string,
    now: Date,
    leaseUntil: Date,
  ): Promise<MailOutboxRecord | null>;
  listDispatchable(
    now: Date,
    staleDispatchBefore: Date,
    limit: number,
  ): Promise<MailOutboxRecord[]>;
  markDispatched(id: string, dispatchedAt: Date): Promise<void>;
  markSent(id: string, sentAt: Date, providerMessageId?: string): Promise<void>;
  scheduleRetry(
    id: string,
    availableAt: Date,
    errorCode: string,
  ): Promise<void>;
  markFailed(id: string, failedAt: Date, errorCode: string): Promise<void>;
}

const toRecord = (job: {
  _id: Types.ObjectId;
  aggregateKey: string;
  kind: MailOutboxRecord["kind"];
  ciphertext: string;
  iv: string;
  authTag: string;
  attempts: number;
  availableAt: Date;
  dispatchedAt?: Date;
  expiresAt: Date;
}): MailOutboxRecord => ({
  id: job._id.toString(),
  aggregateKey: job.aggregateKey,
  kind: job.kind,
  ciphertext: job.ciphertext,
  iv: job.iv,
  authTag: job.authTag,
  attempts: job.attempts,
  availableAt: job.availableAt,
  ...(job.dispatchedAt ? { dispatchedAt: job.dispatchedAt } : {}),
  expiresAt: job.expiresAt,
});

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createMongooseMailOutboxRepository = (
  session?: ClientSession,
): MailOutboxRepository => ({
  async enqueue(input) {
    const query = MailOutboxModel.findOneAndUpdate(
      { aggregateKey: input.aggregateKey },
      {
        $set: {
          ...input,
          status: "PENDING",
          attempts: 0,
        },
        $unset: {
          leaseUntil: 1,
          lastError: 1,
          providerMessageId: 1,
          sentAt: 1,
          purgeAt: 1,
          dispatchedAt: 1,
        },
      },
      { upsert: true },
    );
    if (session) query.session(session);
    await query.exec();
  },

  async cancel(aggregateKey) {
    const query = MailOutboxModel.deleteOne({
      aggregateKey,
      status: { $in: ["PENDING", "PROCESSING"] },
    });
    if (session) query.session(session);
    await query.exec();
  },

  async cancelByPrefix(prefix) {
    const query = MailOutboxModel.deleteMany({
      aggregateKey: { $regex: `^${escapeRegex(prefix)}` },
      status: { $in: ["PENDING", "PROCESSING"] },
    });
    if (session) query.session(session);
    await query.exec();
  },

  async claimNext(now, leaseUntil) {
    const job = await MailOutboxModel.findOneAndUpdate(
      {
        expiresAt: { $gt: now },
        $or: [
          { status: "PENDING", availableAt: { $lte: now } },
          { status: "PROCESSING", leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { status: "PROCESSING", leaseUntil },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { availableAt: 1, createdAt: 1 } },
    )
      .lean()
      .exec();

    return job ? toRecord(job) : null;
  },

  async claimById(id, now, leaseUntil) {
    if (!Types.ObjectId.isValid(id)) return null;
    const job = await MailOutboxModel.findOneAndUpdate(
      {
        _id: id,
        expiresAt: { $gt: now },
        $or: [
          { status: "PENDING", availableAt: { $lte: now } },
          { status: "PROCESSING", leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { status: "PROCESSING", leaseUntil },
        $inc: { attempts: 1 },
      },
      { new: true },
    )
      .lean()
      .exec();
    return job ? toRecord(job) : null;
  },

  async listDispatchable(now, staleDispatchBefore, limit) {
    const jobs = await MailOutboxModel.find({
      expiresAt: { $gt: now },
      $or: [
        {
          status: "PENDING",
          availableAt: { $lte: now },
          $or: [
            { dispatchedAt: { $exists: false } },
            { dispatchedAt: { $lte: staleDispatchBefore } },
          ],
        },
        { status: "PROCESSING", leaseUntil: { $lte: now } },
      ],
    })
      .sort({ availableAt: 1, createdAt: 1 })
      .limit(limit)
      .lean()
      .exec();
    return jobs.map(toRecord);
  },

  async markDispatched(id, dispatchedAt) {
    await MailOutboxModel.updateOne(
      { _id: id, status: { $in: ["PENDING", "PROCESSING"] } },
      { $set: { dispatchedAt } },
    ).exec();
  },

  async markSent(id, sentAt, providerMessageId) {
    await MailOutboxModel.updateOne(
      { _id: id, status: "PROCESSING" },
      {
        $set: {
          status: "SENT",
          sentAt,
          purgeAt: new Date(sentAt.getTime() + RETENTION_MS),
          ...(providerMessageId ? { providerMessageId } : {}),
        },
        $unset: { leaseUntil: 1, lastError: 1, dispatchedAt: 1 },
      },
    ).exec();
  },

  async scheduleRetry(id, availableAt, errorCode) {
    await MailOutboxModel.updateOne(
      { _id: id, status: "PROCESSING" },
      {
        $set: { status: "PENDING", availableAt, lastError: errorCode },
        $unset: { leaseUntil: 1, dispatchedAt: 1 },
      },
    ).exec();
  },

  async markFailed(id, failedAt, errorCode) {
    await MailOutboxModel.updateOne(
      { _id: id, status: "PROCESSING" },
      {
        $set: {
          status: "FAILED",
          lastError: errorCode,
          purgeAt: new Date(failedAt.getTime() + RETENTION_MS),
        },
        $unset: { leaseUntil: 1, dispatchedAt: 1 },
      },
    ).exec();
  },
});
