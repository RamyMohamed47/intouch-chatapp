import { updateReadReceiptSchema } from "@intouch/shared/messages";
import { z } from "zod";

export const readReceiptParamsSchema = z
  .object({
    conversationId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Conversation ID must be a valid MongoDB ID"),
  })
  .strict();

export { updateReadReceiptSchema };

export type ReadReceiptParams = z.infer<typeof readReceiptParamsSchema>;
