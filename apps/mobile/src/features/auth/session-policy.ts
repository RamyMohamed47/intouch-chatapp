import { ApiError } from "@/core/api/client";

/**
 * Only an explicit rejection from the API ends a stored session. Network
 * failures, timeouts, throttling, and server errors leave it intact so the
 * user is not signed out by a transient outage.
 */
export const isSessionRejected = (error: unknown) =>
  error instanceof ApiError && (error.status === 400 || error.status === 401);
