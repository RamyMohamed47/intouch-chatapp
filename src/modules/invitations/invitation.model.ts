import { Schema, model } from "mongoose";

import type { Invitation } from "./invitation.types.js";

const invitationSchema = new Schema<Invitation>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    invitedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

invitationSchema.index(
  { organizationId: 1, invitedUserId: 1 },
  { name: "unique_pending_organization_invitation", unique: true },
);
invitationSchema.index(
  { invitedUserId: 1, createdAt: -1 },
  { name: "pending_invitations_by_user" },
);
invitationSchema.index(
  { expiresAt: 1 },
  { name: "expire_pending_invitations", expireAfterSeconds: 0 },
);

const InvitationModel = model<Invitation>("Invitation", invitationSchema);

export default InvitationModel;
