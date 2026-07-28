import { z } from "zod";

import { registerSchema } from "./register.schema.js";

export const loginSchema = registerSchema.pick({
  email: true,
  password: true,
});

export type LoginInput = z.infer<typeof loginSchema>;
