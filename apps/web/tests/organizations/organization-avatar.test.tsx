import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { OrganizationAvatar } from "@/components/organizations/organization-avatar";
import { server } from "../mocks/server";

const assetId = "507f1f77bcf86cd799439011";

const renderAvatar = (logoAssetId: string | null) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <OrganizationAvatar name="Product Team" logoAssetId={logoAssetId} />
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
};

describe("OrganizationAvatar", () => {
  it("falls back to organization initials when no logo exists", () => {
    renderAvatar(null);
    expect(screen.getByText("PT")).toBeInTheDocument();
  });

  it("resolves private logo bytes through authorized asset access", async () => {
    server.use(
      http.get(`http://localhost:3000/api/v1/assets/${assetId}/access`, () =>
        HttpResponse.json({
          accessUrl: "https://r2.example.test/signed-logo",
          expiresAt: "2026-08-30T12:10:00.000Z",
        }),
      ),
    );
    const view = renderAvatar(assetId);

    await waitFor(() => {
      expect(
        view.queryClient.getQueryData(["assets", assetId, "access"]),
      ).toEqual({
        accessUrl: "https://r2.example.test/signed-logo",
        expiresAt: "2026-08-30T12:10:00.000Z",
      });
    });
  });
});
