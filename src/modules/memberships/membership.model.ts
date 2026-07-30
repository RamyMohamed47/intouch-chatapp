import { Schema, model } from "mongoose";

import { MembershipRole, type Membership } from "./membership.types.js";

const membershipSchema = new Schema<Membership>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(MembershipRole),
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    versionKey: false,
  },
);

membershipSchema.index(
  { organizationId: 1, userId: 1 },
  { name: "unique_organization_membership", unique: true },
);
membershipSchema.index(
  { organizationId: 1, role: 1 },
  {
    name: "unique_organization_owner",
    unique: true,
    partialFilterExpression: { role: MembershipRole.OWNER },
  },
);
membershipSchema.index(
  { userId: 1, joinedAt: -1 },
  { name: "memberships_by_user" },
);

const MembershipModel = model<Membership>("Membership", membershipSchema);

export default MembershipModel;
