import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/lib/ai/use-ai-generation", () => ({
  useAiGeneration: () => ({
    error: null,
    reset: mocks.reset,
    sources: [],
    start: mocks.start,
    status: "idle" as const,
    stop: mocks.stop,
    text: "",
  }),
}));

vi.mock("@/lib/query/hooks", () => ({
  useAiSettings: () => ({
    data: {
      available: true,
      organizationEnabled: true,
      userConsentAccepted: true,
      canManage: true,
      disclosureVersion: "ai-data-use-v1",
      provider: "GEMINI",
      serviceTier: "FREE",
      dataUseNotice: "Test disclosure",
      quota: {
        userRemaining: 25,
        organizationRemaining: 200,
        resetsAt: "2026-09-08T00:00:00.000Z",
      },
    },
    isError: false,
    isPending: false,
  }),
  useConversation: () => ({
    data: { type: "DIRECT" },
  }),
}));

import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";

const organizationId = "507f1f77bcf86cd799439011";
const conversationId = "507f1f77bcf86cd799439012";

describe("AiAssistantPanel", () => {
  let scrollHeightDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 720,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    if (scrollHeightDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollHeight",
        scrollHeightDescriptor,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    }
    vi.unstubAllGlobals();
  });

  it("scrolls the conversation viewport to the bottom whenever it opens", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const renderPanel = (open: boolean) => (
      <QueryClientProvider client={queryClient}>
        <AiAssistantPanel
          organizationId={organizationId}
          conversationId={conversationId}
          open={open}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>
    );
    const view = render(renderPanel(true));

    const getViewport = () =>
      screen
        .getByText(
          "Ask about decisions, plans, or discussions in channels you can access.",
        )
        .closest('[data-slot="scroll-area-viewport"]');
    const viewport = getViewport();
    expect(viewport).toBeInstanceOf(HTMLElement);
    await waitFor(() => expect(viewport).toHaveProperty("scrollTop", 720));

    if (!(viewport instanceof HTMLElement)) return;
    viewport.scrollTop = 0;
    view.rerender(renderPanel(false));
    view.rerender(renderPanel(true));

    await waitFor(() => expect(getViewport()).toHaveProperty("scrollTop", 720));
  });
});
