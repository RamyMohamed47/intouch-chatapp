import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ChatWallpaperId,
  ChatWallpaperSource,
} from "@intouch/shared/chat-wallpapers";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetConversation: vi.fn(() => Promise.resolve(undefined)),
  setDefault: vi.fn((input) =>
    Promise.resolve({ ...input, source: "DEFAULT" as const }),
  ),
  setForConversation: vi.fn((conversationId: string, input) =>
    Promise.resolve({
      ...input,
      source: "CONVERSATION" as const,
      conversationId,
    }),
  ),
}));

vi.mock("@/lib/api/chat-wallpapers", () => ({
  chatWallpapersApi: mocks,
}));

import { ChatWallpaperDialog } from "@/components/conversations/chat-wallpaper-dialog";

const conversationId = "64d000000000000000000001";

const renderDialog = (source: "DEFAULT" | "CONVERSATION" = "DEFAULT") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatWallpaperDialog
        conversationId={conversationId}
        wallpaper={{
          wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
          dimming: 35,
          source,
        }}
      />
    </QueryClientProvider>,
  );
};

describe("ChatWallpaperDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("previews and applies a preset to the current conversation", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Choose chat wallpaper" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /Blue-hour coast: Still water and a warm horizon/i,
      }),
    );
    fireEvent.change(screen.getByRole("slider", { name: "Dimming" }), {
      target: { value: "44" },
    });
    await user.click(
      screen.getByRole("button", { name: "Apply to this chat" }),
    );

    await waitFor(() =>
      expect(mocks.setForConversation).toHaveBeenCalledWith(conversationId, {
        wallpaperId: ChatWallpaperId.SCENERY_COAST,
        dimming: 44,
      }),
    );
  });

  it("sets a global default without replacing stored overrides", async () => {
    const user = userEvent.setup();
    renderDialog(ChatWallpaperSource.CONVERSATION);

    await user.click(
      screen.getByRole("button", { name: "Choose chat wallpaper" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /Ocean depth: A quiet field of layered blues/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Set as default" }));

    await waitFor(() =>
      expect(mocks.setDefault).toHaveBeenCalledWith({
        wallpaperId: ChatWallpaperId.ABSTRACT_OCEAN,
        dimming: 35,
      }),
    );
    expect(mocks.resetConversation).not.toHaveBeenCalled();
  });

  it("offers reset only for a conversation override", async () => {
    const user = userEvent.setup();
    const view = renderDialog();
    await user.click(
      screen.getByRole("button", { name: "Choose chat wallpaper" }),
    );
    expect(
      screen.queryByRole("button", { name: "Use my default" }),
    ).not.toBeInTheDocument();

    view.unmount();
    renderDialog(ChatWallpaperSource.CONVERSATION);
    await user.click(
      screen.getByRole("button", { name: "Choose chat wallpaper" }),
    );
    await user.click(screen.getByRole("button", { name: "Use my default" }));
    await waitFor(() =>
      expect(mocks.resetConversation).toHaveBeenCalledWith(conversationId),
    );
  });
});
