import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthPage } from "@/components/auth/auth-page";

type TestAuthStatus = "loading" | "authenticated" | "unauthenticated";

const mocks = vi.hoisted(
  (): {
    status: TestAuthStatus;
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    routerReplace: ReturnType<typeof vi.fn>;
  } => ({
    status: "loading",
    login: vi.fn(),
    register: vi.fn(),
    routerReplace: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.routerReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    status: mocks.status,
    login: mocks.login,
    register: mocks.register,
  }),
}));

vi.mock("@/components/brand/brand", () => ({
  BrandLockup: () => <div aria-hidden="true" />,
  BrandSignature: () => <div aria-hidden="true" />,
}));

describe("AuthPage session restoration", () => {
  beforeEach(() => {
    mocks.status = "loading";
  });

  it("hides authentication controls while restoring a cookie session", () => {
    render(<AuthPage mode="login" />);

    expect(screen.getByText("Restoring your session...")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  });

  it("keeps controls hidden while redirecting an authenticated user", async () => {
    mocks.status = "authenticated";
    render(<AuthPage mode="login" />);

    expect(screen.getByText("Opening your workspace...")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.routerReplace).toHaveBeenCalledWith("/app"),
    );
  });

  it("renders authentication controls after restoration finds no session", () => {
    mocks.status = "unauthenticated";
    render(<AuthPage mode="login" />);

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});
