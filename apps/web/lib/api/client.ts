import { getAccessToken, setAccessToken } from "@/lib/auth/access-token";
import { errorResponseSchema } from "@intouch/shared/common";
import { refreshResponseSchema } from "@intouch/shared/auth";

interface ResponseSchema<T> {
  parse(input: unknown): T;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

let refreshRequest: Promise<string | null> | null = null;

const parseError = async (response: Response) => {
  const fallback = new ApiError(
    response.status,
    "REQUEST_FAILED",
    "The request could not be completed",
  );

  try {
    const body = errorResponseSchema.safeParse(await response.json());
    if (body.success) {
      return new ApiError(
        response.status,
        body.data.error.code,
        body.data.error.message,
      );
    }
  } catch {
    return fallback;
  }

  return fallback;
};

export const refreshAccessToken = () => {
  refreshRequest ??= fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-CSRF-Protection": "1" },
  })
    .then(async (response) => {
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }

      const body = refreshResponseSchema.parse(await response.json());
      setAccessToken(body.accessToken);
      return body.accessToken;
    })
    .finally(() => {
      refreshRequest = null;
    });

  return refreshRequest;
};

export const apiRequest = async <T>(
  path: `/api/v1/${string}`,
  responseSchema: ResponseSchema<T>,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> => {
  const headers = new Headers(init.headers);
  const accessToken = getAccessToken();

  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 401 && retryAfterRefresh) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      return apiRequest(path, responseSchema, init, false);
    }
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return responseSchema.parse(undefined);
  return responseSchema.parse(await response.json());
};
