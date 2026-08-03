import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@intouch/shared/categories";

import type { MembershipService } from "../memberships/index.js";
import type { OrganizationRepository } from "../organizations/organization.repository.js";
import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import normalizeNameKey from "../../utils/normalizeNameKey.js";
import {
  CategoryConflictError,
  CategoryNotFoundError,
} from "./category.errors.js";
import {
  CategoryPersistenceConflictError,
  type CategoryRepository,
} from "./category.repository.js";

export interface CategoryServiceDependencies {
  categories: CategoryRepository;
  memberships: MembershipService;
  organizations: OrganizationRepository;
  policy: OrganizationPolicy;
  unitOfWork: OrganizationUnitOfWork;
}

const mapConflict = (error: unknown): never => {
  if (error instanceof CategoryPersistenceConflictError) {
    throw new CategoryConflictError();
  }

  throw error;
};

const createCategoryService = ({
  categories,
  memberships,
  organizations,
  policy,
  unitOfWork,
}: CategoryServiceDependencies) => ({
  async create(
    userId: string,
    organizationId: string,
    input: CreateCategoryInput,
  ) {
    try {
      return await unitOfWork.run(async (context) => {
        const organization =
          await context.organizations.findById(organizationId);
        const membership = await context.memberships.findForUser(
          userId,
          organizationId,
        );
        policy.assertOwner(organization, membership);
        const position =
          await context.categories.countByOrganization(organizationId);

        return context.categories.create({
          organizationId,
          name: input.name,
          nameKey: normalizeNameKey(input.name),
          position,
        });
      });
    } catch (error) {
      return mapConflict(error);
    }
  },

  async list(userId: string, organizationId: string) {
    const organization = await organizations.findById(organizationId);
    const membership = await memberships.findForUser(userId, organizationId);
    policy.assertMember(organization, membership);
    return categories.listByOrganization(organizationId);
  },

  async update(
    userId: string,
    organizationId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ) {
    try {
      return await unitOfWork.run(async (context) => {
        const organization =
          await context.organizations.findById(organizationId);
        const membership = await context.memberships.findForUser(
          userId,
          organizationId,
        );
        policy.assertOwner(organization, membership);
        const category = await context.categories.findById(categoryId);

        if (!category || category.organizationId !== organizationId) {
          throw new CategoryNotFoundError();
        }

        let position = category.position;
        if (input.position !== undefined) {
          const count =
            await context.categories.countByOrganization(organizationId);
          position = Math.min(input.position, Math.max(0, count - 1));

          if (position < category.position) {
            await context.categories.shiftPositions(
              organizationId,
              position,
              category.position - 1,
              1,
            );
          } else if (position > category.position) {
            await context.categories.shiftPositions(
              organizationId,
              category.position + 1,
              position,
              -1,
            );
          }
        }

        const updated = await context.categories.updateById(categoryId, {
          ...(input.name !== undefined
            ? { name: input.name, nameKey: normalizeNameKey(input.name) }
            : {}),
          ...(position !== category.position ? { position } : {}),
        });

        if (!updated) throw new CategoryNotFoundError();
        return updated;
      });
    } catch (error) {
      return mapConflict(error);
    }
  },

  async delete(userId: string, organizationId: string, categoryId: string) {
    await unitOfWork.run(async (context) => {
      const organization = await context.organizations.findById(organizationId);
      const membership = await context.memberships.findForUser(
        userId,
        organizationId,
      );
      policy.assertOwner(organization, membership);
      const category = await context.categories.findById(categoryId);

      if (!category || category.organizationId !== organizationId) {
        throw new CategoryNotFoundError();
      }

      if ((await context.conversations.countByCategory(categoryId)) > 0) {
        throw new CategoryConflictError(
          "Category must be empty before it can be deleted",
        );
      }

      const count =
        await context.categories.countByOrganization(organizationId);
      if (!(await context.categories.deleteById(categoryId))) {
        throw new CategoryNotFoundError();
      }
      await context.categories.shiftPositions(
        organizationId,
        category.position + 1,
        count - 1,
        -1,
      );
    });
  },
});

export type CategoryService = ReturnType<typeof createCategoryService>;
export default createCategoryService;
