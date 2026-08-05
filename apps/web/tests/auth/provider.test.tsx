import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { setAccessToken } from "@/lib/auth/access-token";
import { AuthProvider, useAuth } from "@/lib/auth/provider";
import { server } from "../mocks/server";

const publicUser = {
  id: "64b000000000000000000001",
  username: "ramy",
  displayName: "Ramy Mohamed",
  email: "ramy@example.com",
  createdAt: "2026-08-05T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.status}</span>
      <span>{auth.user?.displayName ?? "anonymous"}</span>
      <button type="button" onClick={() => void auth.logout()}>
        Logout
      </button>
    </div>
  );
}

const renderProvider = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return client;
};

describe("AuthProvider", () => {
  beforeEach(() => setAccessToken(null));

  it("restores a refresh-cookie session into memory", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json({ accessToken: "restored-token" }),
      ),
      http.get("http://localhost:3000/api/v1/auth/me", () =>
        HttpResponse.json({ user: publicUser }),
      ),
    );

    renderProvider();
    expect(screen.getByText("loading")).toBeInTheDocument();
    await screen.findByText("authenticated");
    expect(screen.getByText("Ramy Mohamed")).toBeInTheDocument();
  });

  it("clears auth state and query cache during logout", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json({ accessToken: "restored-token" }),
      ),
      http.get("http://localhost:3000/api/v1/auth/me", () =>
        HttpResponse.json({ user: publicUser }),
      ),
      http.post(
        "http://localhost:3000/api/v1/auth/logout",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const client = renderProvider();
    client.setQueryData(["private"], { secret: true });
    await screen.findByText("authenticated");

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() =>
      expect(screen.getByText("unauthenticated")).toBeInTheDocument(),
    );
    expect(screen.getByText("anonymous")).toBeInTheDocument();
    expect(client.getQueryData(["private"])).toBeUndefined();
  });

  it("becomes unauthenticated when refresh restoration fails", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Expired" },
          },
          { status: 401 },
        ),
      ),
    );

    renderProvider();
    await screen.findByText("unauthenticated");
  });
});
