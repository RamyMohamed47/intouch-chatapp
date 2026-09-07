import { errorResponseSchema } from "@intouch/shared/common";

import { mobileConfig } from "@/core/config";

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

const parseError = async (response: Response) => {
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
  const headers = new Headers(init.headers);
  const accessToken = authTransport.getAccessToken();

  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${mobileConfig.apiUrl}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && retryAfterRefresh) {
    const refreshedToken = await authTransport.refresh();
    if (refreshedToken) return apiRequest(path, schema, init, false);
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return schema.parse(undefined);
  return schema.parse(await response.json());
};
