import { z } from "zod";

export const identifierDtoSchema = z.string().min(1);

export const dateTimeDtoSchema = z
  .union([z.date(), z.string().datetime({ offset: true })])
  .transform((value) =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString(),
  );

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  SEARCH_UNAVAILABLE: "SEARCH_UNAVAILABLE",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export const errorCodeSchema = z.enum(ErrorCode);

export const errorDtoSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: errorDtoSchema.extend({ code: errorCodeSchema }),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  uptime: z.number().nonnegative(),
  timestamp: dateTimeDtoSchema,
});

export type ErrorCodeValue = z.infer<typeof errorCodeSchema>;
export type ErrorDto = z.infer<typeof errorDtoSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
