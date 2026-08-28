import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  latestQuery: "",
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("@/lib/query/hooks", () => ({
  useOrganizationSearch: (_organizationId: string, input: { q: string }) => {
    mocks.latestQuery = input.q;
    return {
      data:
        input.q === "roadmap"
          ? {
              pages: [
                {
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
                },
              ],
            }
          : undefined,
      isPending: input.q.length >= 2 && input.q !== "roadmap",
      isError: false,
      refetch: vi.fn(),
    };
  },
}));

import { OrganizationSearchDialog } from "@/components/search/organization-search-dialog";

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
    }
  >
    {children}
  </QueryClientProvider>
);

describe("OrganizationSearchDialog", () => {
  it("explains organization scoping from the workspace hub", () => {
    render(<OrganizationSearchDialog open onOpenChange={vi.fn()} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText("Choose an organization first")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Search organization" }),
    ).toBeDisabled();
  });

  it("debounces a valid query and renders safe highlighted text", async () => {
    const user = userEvent.setup();
    render(
      <OrganizationSearchDialog
        organizationId="64c000000000000000000001"
        open
        onOpenChange={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    await user.type(
      screen.getByRole("textbox", { name: "Search organization" }),
      "roadmap",
    );
    await waitFor(() => expect(mocks.latestQuery).toBe("roadmap"));
    expect(await screen.findByText("Messages")).toBeVisible();
    expect(screen.getByText("roadmap").tagName).toBe("MARK");
  });
});
