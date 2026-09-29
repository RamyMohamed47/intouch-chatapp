import { ApiError } from "@/core/api/client";
import { shouldRetryQuery } from "@/core/api/query-retry";

describe("mobile query retry policy", () => {
  it("does not retry handled client errors", () => {
    expect(
      shouldRetryQuery(
        0,
        new ApiError(409, "CONFLICT", "Resource conflict", null),
      ),
    ).toBe(false);
  });

  it("keeps bounded retries for server and network failures", () => {
    const serverError = new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      null,
    );

    expect(shouldRetryQuery(0, serverError)).toBe(true);
    expect(shouldRetryQuery(1, new Error("Network unavailable"))).toBe(true);
    expect(shouldRetryQuery(2, serverError)).toBe(false);
  });
});
