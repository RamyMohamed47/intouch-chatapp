import { Schema, model } from "mongoose";

import type { AiOrganizationSettings, AiUserConsent } from "./ai.types.js";

const aiOrganizationSettingsSchema = new Schema<AiOrganizationSettings>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    enabled: { type: Boolean, required: true },
    disclosureVersion: { type: String, required: true, maxlength: 50 },
    enabledByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    enabledAt: { type: Date, required: true },
  },
  { timestamps: true },
);
aiOrganizationSettingsSchema.index(
  { organizationId: 1 },
  { name: "unique_ai_organization_settings", unique: true },
);

const aiUserConsentSchema = new Schema<AiUserConsent>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    disclosureVersion: { type: String, required: true, maxlength: 50 },
    acceptedAt: { type: Date, required: true },
  },
  { timestamps: true },
);
aiUserConsentSchema.index(
  { organizationId: 1, userId: 1 },
  { name: "unique_ai_user_consent", unique: true },
);

export const AiOrganizationSettingsModel = model<AiOrganizationSettings>(
  "AiOrganizationSettings",
  aiOrganizationSettingsSchema,
);
export const AiUserConsentModel = model<AiUserConsent>(
  "AiUserConsent",
  aiUserConsentSchema,
);
