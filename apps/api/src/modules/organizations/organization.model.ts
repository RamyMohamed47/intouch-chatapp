import { OrganizationVisibility } from "@intouch/shared/organizations";
import { Schema, model } from "mongoose";

import type { Organization } from "./organization.types.js";

const organizationSchema = new Schema<Organization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: String,
    visibility: {
      type: String,
      enum: Object.values(OrganizationVisibility),
      default: OrganizationVisibility.PRIVATE,
      required: true,
    },
    mutationVersion: {
      type: Number,
      default: 0,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

organizationSchema.index(
  { slug: 1 },
  { name: "unique_organization_slug", unique: true },
);

const OrganizationModel = model<Organization>(
  "Organization",
  organizationSchema,
);

export default OrganizationModel;
