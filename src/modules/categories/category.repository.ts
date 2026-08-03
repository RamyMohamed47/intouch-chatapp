import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import CategoryModel from "./category.model.js";
import type {
  Category,
  CategoryRecord,
  CreateCategoryRecordInput,
  UpdateCategoryRecordInput,
} from "./category.types.js";

interface CategoryDocument extends Category {
  _id: Types.ObjectId;
}

export class CategoryPersistenceConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Category name already exists", options);
    this.name = "CategoryPersistenceConflictError";
  }
}

export interface CategoryRepository {
  create(input: CreateCategoryRecordInput): Promise<CategoryRecord>;
  findById(categoryId: string): Promise<CategoryRecord | null>;
  listByOrganization(organizationId: string): Promise<CategoryRecord[]>;
  countByOrganization(organizationId: string): Promise<number>;
  updateById(
    categoryId: string,
    input: UpdateCategoryRecordInput,
  ): Promise<CategoryRecord | null>;
  shiftPositions(
    organizationId: string,
    minimum: number,
    maximum: number,
    amount: number,
  ): Promise<void>;
  deleteById(categoryId: string): Promise<boolean>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const toCategoryRecord = (category: CategoryDocument): CategoryRecord => ({
  id: category._id.toString(),
  organizationId: category.organizationId.toString(),
  name: category.name,
  position: category.position,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const createMongooseCategoryRepository = (
  session?: ClientSession,
): CategoryRepository => ({
  async create(input) {
    try {
      const categories = await CategoryModel.create(
        [input],
        session ? { session } : {},
      );
      const category = categories[0];

      if (!category) {
        throw new Error("Category creation returned no document");
      }

      return toCategoryRecord(category.toObject<CategoryDocument>());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new CategoryPersistenceConflictError({ cause: error });
      }

      throw error;
    }
  },

  async findById(categoryId) {
    const query = CategoryModel.findById(categoryId).lean<CategoryDocument>();
    if (session) query.session(session);
    const category = await query.exec();
    return category ? toCategoryRecord(category) : null;
  },

  async listByOrganization(organizationId) {
    const query = CategoryModel.find({ organizationId })
      .sort({ position: 1, _id: 1 })
      .lean<CategoryDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toCategoryRecord);
  },

  async countByOrganization(organizationId) {
    const query = CategoryModel.countDocuments({ organizationId });
    if (session) query.session(session);
    return query.exec();
  },

  async updateById(categoryId, input) {
    try {
      const query = CategoryModel.findByIdAndUpdate(
        categoryId,
        { $set: input },
        { new: true, runValidators: true },
      ).lean<CategoryDocument>();
      if (session) query.session(session);
      const category = await query.exec();
      return category ? toCategoryRecord(category) : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new CategoryPersistenceConflictError({ cause: error });
      }

      throw error;
    }
  },

  async shiftPositions(organizationId, minimum, maximum, amount) {
    if (minimum > maximum || amount === 0) return;
    const query = CategoryModel.updateMany(
      { organizationId, position: { $gte: minimum, $lte: maximum } },
      { $inc: { position: amount } },
    );
    if (session) query.session(session);
    await query.exec();
  },

  async deleteById(categoryId) {
    const query = CategoryModel.deleteOne({ _id: categoryId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount === 1;
  },

  async deleteByOrganizationId(organizationId) {
    const query = CategoryModel.deleteMany({ organizationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },
});

export default createMongooseCategoryRepository;
