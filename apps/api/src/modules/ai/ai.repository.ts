import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import { AiOrganizationSettingsModel, AiUserConsentModel } from "./ai.model.js";
import type {
  AiConsentRecord,
  AiOrganizationSettings,
  AiSettingsRecord,
  AiUserConsent,
} from "./ai.types.js";

interface SettingsDocument extends AiOrganizationSettings {
  _id: Types.ObjectId;
}
interface ConsentDocument extends AiUserConsent {
  _id: Types.ObjectId;
}

const toSettings = (record: SettingsDocument): AiSettingsRecord => ({
  organizationId: record.organizationId.toString(),
  enabled: record.enabled,
  disclosureVersion: record.disclosureVersion,
  enabledByUserId: record.enabledByUserId.toString(),
  enabledAt: record.enabledAt,
});
const toConsent = (record: ConsentDocument): AiConsentRecord => ({
  organizationId: record.organizationId.toString(),
  userId: record.userId.toString(),
  disclosureVersion: record.disclosureVersion,
  acceptedAt: record.acceptedAt,
});

export interface AiRepository {
  findSettings(organizationId: string): Promise<AiSettingsRecord | null>;
  setEnabled(input: {
    organizationId: string;
    userId: string;
    disclosureVersion: string;
    now: Date;
  }): Promise<AiSettingsRecord>;
  disable(organizationId: string): Promise<void>;
  findConsent(
    organizationId: string,
    userId: string,
  ): Promise<AiConsentRecord | null>;
  acceptConsent(input: {
    organizationId: string;
    userId: string;
    disclosureVersion: string;
    now: Date;
  }): Promise<AiConsentRecord>;
  deleteConsent(organizationId: string, userId: string): Promise<void>;
  deleteConsentsByOrganization(organizationId: string): Promise<void>;
  deleteByOrganization(organizationId: string): Promise<void>;
}

const createMongooseAiRepository = (session?: ClientSession): AiRepository => ({
  async findSettings(organizationId) {
    const query = AiOrganizationSettingsModel.findOne({
      organizationId,
    }).lean<SettingsDocument>();
    if (session) query.session(session);
    const record = await query.exec();
    return record ? toSettings(record) : null;
  },
  async setEnabled({ organizationId, userId, disclosureVersion, now }) {
    const query = AiOrganizationSettingsModel.findOneAndUpdate(
      { organizationId },
      {
        $set: {
          enabled: true,
          disclosureVersion,
          enabledByUserId: userId,
          enabledAt: now,
        },
      },
      { new: true, upsert: true, runValidators: true },
    ).lean<SettingsDocument>();
    if (session) query.session(session);
    const record = await query.exec();
    if (!record) throw new Error("AI settings update returned no document");
    return toSettings(record);
  },
  async disable(organizationId) {
    const query = AiOrganizationSettingsModel.updateOne(
      { organizationId },
      { $set: { enabled: false } },
    );
    if (session) query.session(session);
    await query.exec();
  },
  async findConsent(organizationId, userId) {
    const query = AiUserConsentModel.findOne({
      organizationId,
      userId,
    }).lean<ConsentDocument>();
    if (session) query.session(session);
    const record = await query.exec();
    return record ? toConsent(record) : null;
  },
  async acceptConsent({ organizationId, userId, disclosureVersion, now }) {
    const query = AiUserConsentModel.findOneAndUpdate(
      { organizationId, userId },
      { $set: { disclosureVersion, acceptedAt: now } },
      { new: true, upsert: true, runValidators: true },
    ).lean<ConsentDocument>();
    if (session) query.session(session);
    const record = await query.exec();
    if (!record) throw new Error("AI consent update returned no document");
    return toConsent(record);
  },
  async deleteConsent(organizationId, userId) {
    const query = AiUserConsentModel.deleteOne({ organizationId, userId });
    if (session) query.session(session);
    await query.exec();
  },
  async deleteConsentsByOrganization(organizationId) {
    const query = AiUserConsentModel.deleteMany({ organizationId });
    if (session) query.session(session);
    await query.exec();
  },
  async deleteByOrganization(organizationId) {
    await Promise.all([
      AiOrganizationSettingsModel.deleteMany({ organizationId }).session(
        session ?? null,
      ),
      AiUserConsentModel.deleteMany({ organizationId }).session(
        session ?? null,
      ),
    ]);
  },
});

export default createMongooseAiRepository;
