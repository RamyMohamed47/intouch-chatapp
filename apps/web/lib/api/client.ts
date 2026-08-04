import { getAccessToken, setAccessToken } from "@/lib/auth/access-token";

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

interface RefreshResponse {
  accessToken: string;
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
    const body = (await response.json()) as Partial<ErrorEnvelope>;
    if (body.error?.code && body.error.message) {
      return new ApiError(response.status, body.error.code, body.error.message);
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

      const body = (await response.json()) as RefreshResponse;
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
    if (refreshedToken) return apiRequest<T>(path, init, false);
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};
