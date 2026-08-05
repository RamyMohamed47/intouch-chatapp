import { expect, test } from "@playwright/test";

// Legacy fixture-only suite. Rebuild against the API-backed runtime before use.

const ids = {
  northstar: "64b000000000000000000001",
  pixel: "64b000000000000000000002",
  productDesign: "64d000000000000000000003",
} as const;

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/v1\/|\/socket\.io\//, (route) => {
    throw new Error(
      `Frontend-only page attempted a network request: ${route.request().url()}`,
    );
  });
});

test("root redirects to the visual login and auth routes remain frontend-only", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Pick up where the work is." }),
  ).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await expect(
      page.locator('[data-testid="brand-signature"]:visible'),
    ).toBeVisible();
  } else {
    await expect(page.getByTestId("brand-lockup")).toBeVisible();
  }
  const brandHome = page.locator('a[aria-label="InTouch home"]:visible');
  await expect(brandHome).toBeVisible();
  await brandHome.focus();
  await expect(brandHome).toBeFocused();

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByRole("heading", { name: "Start with a calmer workspace." }),
  ).toBeVisible();

  await page.goto("/auth/callback?googleAuth=success");
  await expect(
    page.getByRole("heading", { name: "Your workspace is ready." }),
  ).toBeVisible();
  await expect(page.getByTestId("brand-lockup")).toBeVisible();
  await page.getByRole("link", { name: /Continue to workspace/ }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("brand metadata and install assets are available", async ({ request }) => {
  const assets = [
    "/icon.png",
    "/apple-icon.png",
    "/manifest.webmanifest",
    "/brand/intouch-icon-192.png",
    "/brand/intouch-icon-512.png",
    "/brand/intouch-og.png",
  ];

  for (const asset of assets) {
    const response = await request.get(asset);
    expect(response.ok(), `${asset} should resolve`).toBe(true);
  }
});

test("brand lockups adapt across all four themes", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "One desktop visual pass covers theme variants",
  );

  await page.goto("/login");
  for (const theme of ["ink", "cloud", "aurora", "ember"]) {
    await page.evaluate((selectedTheme) => {
      localStorage.setItem("intouch-theme", selectedTheme);
    }, theme);
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByTestId("brand-lockup")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`brand-login-${theme}.png`),
      fullPage: true,
    });
  }
});

test("workspace branding remains visible in responsive navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/app");
  await expect(
    page.locator('[data-testid="brand-mark"]:visible').first(),
  ).toBeVisible();
  await expect(page.getByTestId("brand-lockup")).toBeVisible();

  if (testInfo.project.name.includes("mobile")) {
    await expect(
      page.locator('a[aria-label="InTouch workspace hub"]:visible'),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Open workspace navigation" })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Workspace navigation" })
        .locator('[data-testid="brand-mark"]'),
    ).toBeVisible();
  }
});

test("callback renders processing and failure states", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(
    page.getByRole("heading", { name: "Finishing sign in." }),
  ).toBeVisible();
  await page.goto("/auth/callback?googleAuth=failed");
  await expect(
    page.getByRole("heading", { name: "Sign in did not complete." }),
  ).toBeVisible();
});

test("workspace creation mutates demo state and opens the new organization", async ({
  page,
}) => {
  await page.goto("/app/new-organization");
  await page.getByLabel("Organization name").fill("Signal Works");
  await page.getByLabel("Visibility").selectOption("PUBLIC");
  await page.getByRole("button", { name: /Create workspace/ }).click();

  await expect(page).toHaveURL(/\/app\/[a-f0-9]{24}$/);
  await expect(
    page.getByRole("heading", { name: "Signal Works" }),
  ).toBeVisible();
  await expect(page.getByText("No categories yet.")).toBeVisible();
});

test("invitation acceptance updates the workspace rail", async ({
  page,
}, testInfo) => {
  await page.goto("/app/invitations");
  await expect(page.getByRole("heading", { name: "Studio 47" })).toBeVisible();
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    page.getByText("Studio 47 was added to your workspaces."),
  ).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page
      .getByRole("button", { name: "Open workspace navigation" })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Workspace navigation" })
        .getByLabel("Studio 47"),
    ).toBeVisible();
  } else {
    await expect(page.getByLabel("Studio 47")).toBeVisible();
  }
});

test("invitation decline removes the pending invitation", async ({ page }) => {
  await page.goto("/app/invitations");
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(
    page.getByText("Invitation to Studio 47 declined."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Studio 47" }),
  ).not.toBeVisible();
});

test("owner settings support category and channel management", async ({
  page,
}) => {
  await page.goto(`/app/${ids.northstar}/settings`);
  await page.getByRole("tab", { name: "Categories" }).click();
  await page.getByLabel("Category name").fill("Operations");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.locator('input[value="Operations"]')).toBeVisible();

  await page.getByRole("tab", { name: "Channels" }).click();
  await page.getByLabel("Name", { exact: true }).first().fill("team-updates");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator('input[value="team-updates"]')).toBeVisible();
});

test("owner settings manage private-channel participants", async ({ page }) => {
  await page.goto(`/app/${ids.northstar}/settings`);
  await page.getByRole("tab", { name: "Channels" }).click();

  const privateChannel = page.locator("form").filter({
    has: page.locator('input[value="product-design"]'),
  });
  const linaParticipant = privateChannel.getByRole("button", {
    name: "Lina Okafor",
  });
  await expect(linaParticipant).toHaveAttribute("aria-pressed", "false");
  await linaParticipant.click();
  await expect(linaParticipant).toHaveAttribute("aria-pressed", "true");
});

test("owner can delete an organization from demo state", async ({ page }) => {
  await page.goto(`/app/${ids.northstar}/settings`);
  await page.getByRole("button", { name: "Delete Northstar" }).click();
  await page.getByRole("button", { name: "Delete workspace" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "Good afternoon, Alex." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Northstar" }),
  ).not.toBeVisible();
});

test("member organization settings show owner-only access state", async ({
  page,
}) => {
  await page.goto(`/app/${ids.pixel}/settings`);
  await expect(
    page.getByRole("heading", { name: "Owner access required" }),
  ).toBeVisible();
});

test("channel messages can be sent, edited, and deleted in demo state", async ({
  page,
}) => {
  await page.goto(`/app/${ids.northstar}/channels/${ids.productDesign}`);
  await page
    .getByLabel("Message content")
    .fill("A Playwright message for the team.");
  await page.getByRole("button", { name: "Send message" }).click();

  const message = page.locator("article").last();
  await expect(message).toBeVisible();
  await message.hover();
  await message.getByRole("button", { name: "Message actions" }).click();
  await page.getByRole("menuitem", { name: "Edit message" }).click();
  await message
    .getByLabel("Edit message")
    .fill("An edited Playwright message.");
  await message.getByRole("button", { name: "Save" }).click();
  await expect(
    message.getByText("An edited Playwright message."),
  ).toBeVisible();

  await message.hover();
  await message.getByRole("button", { name: "Message actions" }).click();
  await page.getByRole("menuitem", { name: "Delete message" }).click();
  await expect(message.getByText("Message deleted")).toBeVisible();
});

test("new direct message picker navigates to a private thread", async ({
  page,
}, testInfo) => {
  await page.goto(`/app/${ids.northstar}`);
  if (testInfo.project.name.includes("mobile")) {
    await page
      .getByRole("button", { name: "Open workspace navigation" })
      .click();
  }
  await page.getByRole("button", { name: "Start a direct message" }).click();
  await page.getByRole("button", { name: /Lina Okafor/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/app/${ids.northstar}/direct-messages/[a-f0-9]{24}$`),
    { timeout: 20_000 },
  );
  await expect(
    page.getByRole("heading", { name: "Lina Okafor", exact: true }),
  ).toBeVisible();
});

test("mobile workspace navigation opens and reaches a channel", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("mobile"),
    "Mobile-only interaction",
  );
  await page.goto(`/app/${ids.northstar}`);
  await page.getByRole("button", { name: "Open workspace navigation" }).click();
  await page.getByRole("link", { name: /product-design/ }).click();
  await expect(page).toHaveURL(
    `/app/${ids.northstar}/channels/${ids.productDesign}`,
  );
});
