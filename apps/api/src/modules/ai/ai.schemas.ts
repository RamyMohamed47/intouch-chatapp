import {
  aiConsentUpdateSchema,
  aiOrganizationSettingsUpdateSchema,
  aiResponseRequestSchema,
} from "@intouch/shared/ai";
import { z } from "zod";

export {
  aiConsentUpdateSchema,
  aiOrganizationSettingsUpdateSchema,
  aiResponseRequestSchema,
};

export const aiOrganizationParamsSchema = z
  .object({
    organizationId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Organization ID must be a valid MongoDB ID"),
  })
  .strict();

export type AiOrganizationParams = z.infer<typeof aiOrganizationParamsSchema>;
