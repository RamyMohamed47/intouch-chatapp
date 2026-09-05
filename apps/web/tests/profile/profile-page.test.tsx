import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addFiles: vi.fn(),
  clear: vi.fn(),
  disableCallNotifications: vi.fn(),
  enableCallNotifications: vi.fn(),
  retry: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/voice/call-notifications", () => ({
  callNotificationsEnabled: () => false,
  disableCallNotifications: mocks.disableCallNotifications,
  enableCallNotifications: mocks.enableCallNotifications,
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    user: {
      id: "64b000000000000000000001",
      displayName: "Ramy Mohamed",
      username: "ramy",
      avatarAssetId: null,
      avatarUrl: null,
    },
    updateUser: mocks.updateUser,
  }),
}));

vi.mock("@/lib/uploads/use-upload-queue", () => ({
  useUploadQueue: () => ({
    addFiles: mocks.addFiles,
    clear: mocks.clear,
    items: [],
    retry: mocks.retry,
  }),
}));

vi.mock("@/components/users/user-avatar", () => ({
  UserAvatar: ({ displayName }: { displayName: string }) => (
    <span>{displayName}</span>
  ),
}));

import { ProfilePage } from "@/components/profile/profile-page";

describe("ProfilePage", () => {
  beforeEach(() => {
    mocks.disableCallNotifications.mockReset();
    mocks.enableCallNotifications.mockReset();
    mocks.enableCallNotifications.mockResolvedValue(undefined);
  });

  it("owns a keyboard-accessible scroll region for overflowing settings", () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ProfilePage />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("region", { name: "Profile settings" }),
    ).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
  });

  it("enables call notifications only after registration succeeds", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ProfilePage />
      </QueryClientProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Enable notifications" }),
    );

    await waitFor(() =>
      expect(mocks.enableCallNotifications).toHaveBeenCalledOnce(),
    );
    expect(
      screen.getByRole("button", { name: "Disable notifications" }),
    ).toBeInTheDocument();
  });
});
