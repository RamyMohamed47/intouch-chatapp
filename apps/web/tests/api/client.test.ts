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
import { searchApi } from "@/lib/api/search";
import { messagesApi } from "@/lib/api/messages";
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

  it("preserves the backend request id on transport errors", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/example", () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: "INTERNAL_SERVER_ERROR", message: "Failed" },
          },
          { headers: { "X-Request-Id": "request-123" }, status: 500 },
        ),
      ),
    );

    await expect(
      apiRequest("/api/v1/example", z.object({}), {}, false),
    ).rejects.toMatchObject({ requestId: "request-123" });
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

  it("parses organization search and preserves its filters", async () => {
    server.use(
      http.get(
        "http://localhost:3000/api/v1/organizations/64c000000000000000000001/search",
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("q")).toBe("roadmap");
          expect(url.searchParams.get("type")).toBe("MESSAGES");
          expect(url.searchParams.get("conversationId")).toBe(
            "64d000000000000000000001",
          );
          return HttpResponse.json({
            query: "roadmap",
            type: "MESSAGES",
            results: [
              {
                kind: "MESSAGE",
                id: "64f000000000000000000001",
                conversation: {
                  id: "64d000000000000000000001",
                  type: "CHANNEL",
                  label: "general",
                },
                sender: {
                  id: "64b000000000000000000001",
                  username: "ramy",
                  displayName: "Ramy",
                },
                snippet: [
                  { text: "Updated ", matched: false },
                  { text: "roadmap", matched: true },
                ],
                createdAt: "2026-08-28T10:00:00.000Z",
              },
            ],
            nextCursor: null,
          });
        },
      ),
    );

    await expect(
      searchApi.search("64c000000000000000000001", {
        q: "roadmap",
        type: "MESSAGES",
        conversationId: "64d000000000000000000001",
        limit: 20,
      }),
    ).resolves.toMatchObject({ results: [{ kind: "MESSAGE" }] });
  });

  it("parses exact message context responses", async () => {
    server.use(
      http.get(
        "http://localhost:3000/api/v1/conversations/64d000000000000000000001/messages/64f000000000000000000001/context",
        () =>
          HttpResponse.json({
            anchorMessageId: "64f000000000000000000001",
            messages: [],
            hasEarlier: true,
            hasLater: true,
          }),
      ),
    );

    await expect(
      messagesApi.context(
        "64d000000000000000000001",
        "64f000000000000000000001",
      ),
    ).resolves.toEqual({
      anchorMessageId: "64f000000000000000000001",
      messages: [],
      hasEarlier: true,
      hasLater: true,
    });
  });
});
