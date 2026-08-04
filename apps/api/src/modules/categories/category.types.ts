import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@intouch/shared/categories";
import type { Types } from "mongoose";

export interface Category {
  organizationId: Types.ObjectId;
  name: string;
  nameKey: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryRecord {
  id: string;
  organizationId: string;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryRecordInput {
  organizationId: string;
  name: string;
  nameKey: string;
  position: number;
}

export interface UpdateCategoryRecordInput {
  name?: string;
  nameKey?: string;
  position?: number;
}

export type { CreateCategoryInput, UpdateCategoryInput };
