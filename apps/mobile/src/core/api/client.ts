import { errorResponseSchema } from "@intouch/shared/common";

import { mobileConfig } from "@/core/config";
import { captureNetworkFailure } from "@/core/monitoring/sentry";

interface ResponseSchema<T> {
  parse(input: unknown): T;
}

interface AuthTransport {
  getAccessToken(): string | null;
  refresh(): Promise<string | null>;
}

let authTransport: AuthTransport = {
  getAccessToken: () => null,
  refresh: () => Promise.resolve(null),
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const configureAuthTransport = (transport: AuthTransport) => {
  authTransport = transport;
};

export const parseError = async (response: Response) => {
  const requestId = response.headers.get("X-Request-Id");

  try {
    const result = errorResponseSchema.safeParse(await response.json());
    if (result.success) {
      return new ApiError(
        response.status,
        result.data.error.code,
        result.data.error.message,
        requestId,
      );
    }
  } catch {
    // Fall through to the sanitized error below.
  }

  return new ApiError(
    response.status,
    "REQUEST_FAILED",
    "The request could not be completed",
    requestId,
  );
};

type FetchImplementation = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export const authenticatedFetch = async (
  path: `/api/v1/${string}`,
  init: RequestInit = {},
  fetchImplementation: FetchImplementation = fetch,
  retryAfterRefresh = true,
): Promise<Response> => {
  const headers = new Headers(init.headers);
  const accessToken = authTransport.getAccessToken();

  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetchImplementation(`${mobileConfig.apiUrl}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    captureNetworkFailure({ error, path });
    throw error;
  }

  if (response.status === 401 && retryAfterRefresh) {
    const refreshedToken = await authTransport.refresh();
    if (refreshedToken) {
      return authenticatedFetch(path, init, fetchImplementation, false);
    }
  }

  return response;
};

export const noContentSchema = {
  parse(input: unknown) {
    if (input !== undefined) throw new TypeError("Expected an empty response");
    return undefined;
  },
};

export const apiRequest = async <T>(
  path: `/api/v1/${string}`,
  schema: ResponseSchema<T>,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> => {
  const response = await authenticatedFetch(
    path,
    init,
    fetch,
    retryAfterRefresh,
  );

  if (!response.ok) {
    const error = await parseError(response);
    if (response.status >= 500) {
      captureNetworkFailure({ error, path, status: response.status });
    }
    throw error;
  }
  if (response.status === 204) return schema.parse(undefined);
  return schema.parse(await response.json());
};
