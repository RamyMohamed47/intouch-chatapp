import {
  messageReactionUsersQuerySchema,
  setMessageReactionSchema,
} from "@intouch/shared/messages";
import { z } from "zod";

export const messageReactionParamsSchema = z
  .object({
    messageId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Message ID must be a valid MongoDB ID"),
  })
  .strict();

export { messageReactionUsersQuerySchema, setMessageReactionSchema };

export type MessageReactionParams = z.infer<typeof messageReactionParamsSchema>;
