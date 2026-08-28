import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import {
  ForgotPasswordPage,
  VerifyEmailPage,
} from "@/components/auth/email-action-page";
import { server } from "../mocks/server";

describe("email authentication actions", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    sessionStorage.clear();
  });

  it("shows the same accepted recovery state after a forgot-password request", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/v1/auth/forgot-password",
        async ({ request }) => {
          expect(await request.json()).toEqual({ email: "ramy@example.com" });
          return HttpResponse.json({ accepted: true }, { status: 202 });
        },
      ),
    );
    render(<ForgotPasswordPage />);

    await userEvent.type(
      screen.getByRole("textbox", { name: "Email address" }),
      "RAMY@EXAMPLE.COM",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /send reset link/i }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your inbox",
    );
    expect(screen.getByText(/if that address is eligible/i)).toBeVisible();
  });

  it("consumes a fragment token and clears it from browser history", async () => {
    const token = `${"a".repeat(24)}.${"b".repeat(43)}`;
    window.history.replaceState(null, "", `/verify-email#token=${token}`);
    server.use(
      http.post(
        "http://localhost:3000/api/v1/auth/verify-email",
        async ({ request }) => {
          expect(await request.json()).toEqual({ token });
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    render(<VerifyEmailPage />);

    expect(await screen.findByText("Your account is ready.")).toBeVisible();
    expect(window.location.hash).toBe("");
    expect(
      screen.getByRole("link", { name: /continue to sign in/i }),
    ).toHaveAttribute("href", "/login?verified=1");
  });
});
