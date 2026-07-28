import { z } from "zod";

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username may only contain letters, numbers, and underscores",
      ),
    displayName: z
      .string()
      .trim()
      .min(1, "Display name is required")
      .max(50, "Display name must be at most 50 characters"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("A valid email address is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters")
      .refine(
        (password) => new TextEncoder().encode(password).byteLength <= 72,
        "Password must be at most 72 bytes",
      ),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
