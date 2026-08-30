import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { InviteMemberForm } from "@/components/memberships/invite-member-form";
import { setAccessToken } from "@/lib/auth/access-token";
import { server } from "../mocks/server";

const organizationId = "64c000000000000000000001";

const renderForm = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <InviteMemberForm organizationId={organizationId} />
    </QueryClientProvider>,
  );
};

describe("InviteMemberForm", () => {
  beforeEach(() => setAccessToken("access-token"));

  it("shows an accessible green confirmation and resets the email", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(
        `http://localhost:3000/api/v1/organizations/${organizationId}/invitations`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ email: "person@example.com" });
          return HttpResponse.json({
            invitation: {
              id: "64f000000000000000000001",
              organizationId,
              invitedUserId: "64b000000000000000000002",
              invitedByUserId: "64b000000000000000000001",
              expiresAt: "2026-08-15T10:00:00.000Z",
              createdAt: "2026-08-08T10:00:00.000Z",
              organization: {
                id: organizationId,
                name: "InTouch",
                slug: "intouch",
                visibility: "PRIVATE",
                logoAssetId: null,
              },
            },
          });
        },
      ),
    );

    renderForm();
    const email = screen.getByLabelText("Email address");
    await user.type(email, "Person@Example.com");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Invitation created.");
    expect(status).toHaveClass("text-status");
    expect(email).toHaveValue("");
  });

  it("keeps API failures in the destructive error treatment", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(
        `http://localhost:3000/api/v1/organizations/${organizationId}/invitations`,
        () =>
          HttpResponse.json(
            {
              success: false,
              error: {
                code: "CONFLICT",
                message: "An invitation already exists",
              },
            },
            { status: 409 },
          ),
      ),
    );

    renderForm();
    await user.type(
      screen.getByLabelText("Email address"),
      "person@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("An invitation already exists");
    expect(alert).toHaveClass("text-destructive");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
