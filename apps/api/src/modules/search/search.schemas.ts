import { organizationSearchQuerySchema } from "@intouch/shared/search";
import { z } from "zod";

const mongoId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Organization ID must be a valid MongoDB ID");

export { organizationSearchQuerySchema };

export const organizationSearchParamsSchema = z
  .object({ organizationId: mongoId })
  .strict();

export type OrganizationSearchParams = z.infer<
  typeof organizationSearchParamsSchema
>;
