import mongoose, { Types } from "mongoose";

import type { PushDeviceDto, PushPlatformValue } from "@intouch/shared/push";

import { PushDeviceModel } from "./push-device.model.js";

export interface PushDeviceRecord extends PushDeviceDto {
  id: string;
  userId: string;
  ciphertext: string;
  iv: string;
  authTag: string;
}

const toRecord = (device: {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  installationId: string;
  platform: PushPlatformValue;
  enabled: boolean;
  ciphertext: string;
  iv: string;
  authTag: string;
  updatedAt: Date;
}): PushDeviceRecord => ({
  id: device._id.toString(),
  userId: device.userId.toString(),
  installationId: device.installationId,
  platform: device.platform,
  enabled: device.enabled,
  ciphertext: device.ciphertext,
  iv: device.iv,
  authTag: device.authTag,
  updatedAt: device.updatedAt.toISOString(),
});

export interface PushDeviceRepository {
  register(input: {
    userId: string;
    installationId: string;
    platform: PushPlatformValue;
    tokenHash: string;
    ciphertext: string;
    iv: string;
    authTag: string;
    registeredAt: Date;
  }): Promise<PushDeviceRecord>;
  disableInstallation(userId: string, installationId: string): Promise<void>;
  disableById(id: string, invalidatedAt: Date): Promise<void>;
  listEnabledForUser(userId: string): Promise<PushDeviceRecord[]>;
}

export const createMongoosePushDeviceRepository = (): PushDeviceRepository => ({
  async register(input) {
    return mongoose.connection.transaction(async (session) => {
      await PushDeviceModel.deleteMany({
        tokenHash: input.tokenHash,
        installationId: { $ne: input.installationId },
      })
        .session(session)
        .exec();
      const device = await PushDeviceModel.findOneAndUpdate(
        { installationId: input.installationId },
        {
          $set: {
            userId: input.userId,
            platform: input.platform,
            tokenHash: input.tokenHash,
            ciphertext: input.ciphertext,
            iv: input.iv,
            authTag: input.authTag,
            enabled: true,
            lastRegisteredAt: input.registeredAt,
          },
          $unset: { invalidatedAt: 1, purgeAt: 1 },
        },
        { upsert: true, new: true, session },
      )
        .lean()
        .exec();
      if (!device) throw new Error("Push device registration failed");
      return toRecord(device);
    });
  },
  async disableInstallation(userId, installationId) {
    await PushDeviceModel.deleteOne({ userId, installationId }).exec();
  },
  async disableById(id, invalidatedAt) {
    if (!Types.ObjectId.isValid(id)) return;
    await PushDeviceModel.updateOne(
      { _id: id },
      {
        $set: {
          enabled: false,
          invalidatedAt,
          purgeAt: new Date(invalidatedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    ).exec();
  },
  async listEnabledForUser(userId) {
    return (
      await PushDeviceModel.find({ userId, enabled: true }).lean().exec()
    ).map(toRecord);
  },
});
