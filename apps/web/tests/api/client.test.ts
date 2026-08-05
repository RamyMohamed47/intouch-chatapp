import { http, HttpResponse } from "msw";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ApiError,
  apiRequest,
  noContentSchema,
  refreshAccessToken,
} from "@/lib/api/client";
import { getAccessToken, setAccessToken } from "@/lib/auth/access-token";
import { server } from "../mocks/server";

describe("API transport", () => {
  beforeEach(() => setAccessToken(null));

  it("parses successful DTOs and sends the in-memory bearer token", async () => {
    setAccessToken("access-token");
    server.use(
      http.get("http://localhost:3000/api/v1/example", ({ request }) => {
        expect(request.headers.get("authorization")).toBe(
          "Bearer access-token",
        );
        return HttpResponse.json({ value: "valid" });
      }),
    );

    await expect(
      apiRequest("/api/v1/example", z.object({ value: z.string() })),
    ).resolves.toEqual({ value: "valid" });
  });

  it("rejects malformed success responses", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/example", () =>
        HttpResponse.json({ value: 42 }),
      ),
    );

    await expect(
      apiRequest("/api/v1/example", z.object({ value: z.string() }), {}, false),
    ).rejects.toMatchObject({ name: "ZodError" });
  });

  it("preserves the backend error envelope", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/example", () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: "FORBIDDEN", message: "No access" },
          },
          { status: 403 },
        ),
      ),
    );

    await expect(
      apiRequest("/api/v1/example", z.object({}), {}, false),
    ).rejects.toEqual(new ApiError(403, "FORBIDDEN", "No access"));
  });

  it("handles no-content responses", async () => {
    server.use(
      http.delete(
        "http://localhost:3000/api/v1/example",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(
      apiRequest("/api/v1/example", noContentSchema, { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  it("serializes concurrent refreshes within a tab", async () => {
    let refreshes = 0;
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", async () => {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({ accessToken: "rotated-token" });
      }),
    );

    await expect(
      Promise.all([refreshAccessToken(), refreshAccessToken()]),
    ).resolves.toEqual(["rotated-token", "rotated-token"]);
    expect(refreshes).toBe(1);
    expect(getAccessToken()).toBe("rotated-token");
  });
});
