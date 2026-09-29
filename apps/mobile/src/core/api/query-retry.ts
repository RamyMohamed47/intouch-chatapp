import { ApiError } from "@/core/api/client";

export const shouldRetryQuery = (failureCount: number, error: Error) =>
  failureCount < 2 && (!(error instanceof ApiError) || error.status >= 500);
