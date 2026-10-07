import { ApiError } from "@/core/api/client";
import { isSessionRejected } from "@/features/auth/session-policy";

const apiError = (status: number) =>
  new ApiError(status, "REQUEST_FAILED", "The request failed", null);

describe("mobile session policy", () => {
  test("ends the session when the API rejects the credential", () => {
    expect(isSessionRejected(apiError(401))).toBe(true);
    expect(isSessionRejected(apiError(400))).toBe(true);
  });

  test("keeps the session through throttling and server failures", () => {
    expect(isSessionRejected(apiError(429))).toBe(false);
    expect(isSessionRejected(apiError(500))).toBe(false);
    expect(isSessionRejected(apiError(503))).toBe(false);
  });

  test("keeps the session when the request never reached the API", () => {
    expect(isSessionRejected(new TypeError("Network request failed"))).toBe(
      false,
    );
    expect(isSessionRejected(undefined)).toBe(false);
  });
});
