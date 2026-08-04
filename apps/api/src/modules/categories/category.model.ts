import { Schema, model } from "mongoose";

import type { Category } from "./category.types.js";

const categorySchema = new Schema<Category>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    nameKey: {
      type: String,
      required: true,
      select: false,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true },
);

categorySchema.index(
  { organizationId: 1, nameKey: 1 },
  { name: "unique_category_name_per_organization", unique: true },
);
categorySchema.index(
  { organizationId: 1, position: 1 },
  { name: "categories_by_position" },
);

const CategoryModel = model<Category>("Category", categorySchema);

export default CategoryModel;
