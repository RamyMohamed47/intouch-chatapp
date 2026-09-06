import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createInMemoryAiQuotaStore } from "../src/modules/ai/index.js";

describe("AI quota store", () => {
  test("enforces user and organization daily limits", async () => {
    const store = createInMemoryAiQuotaStore({
      dailyUserRequests: 1,
      dailyOrganizationRequests: 2,
      maxConcurrentRequests: 2,
      now: () => new Date("2026-09-06T10:00:00.000Z"),
    });
    const first = await store.admit("user-1", "organization-1");
    assert.equal(first.allowed, true);
    if (first.allowed) await store.release(first.leaseId);
    const denied = await store.admit("user-1", "organization-1");
    assert.equal(denied.allowed, false);
    if (!denied.allowed) assert.equal(denied.reason, "USER_DAILY");
    const secondUser = await store.admit("user-2", "organization-1");
    assert.equal(secondUser.allowed, true);
    if (secondUser.allowed) await store.release(secondUser.leaseId);
    const organizationDenied = await store.admit("user-3", "organization-1");
    assert.equal(organizationDenied.allowed, false);
    if (!organizationDenied.allowed) {
      assert.equal(organizationDenied.reason, "ORGANIZATION_DAILY");
    }
    store.close();
  });

  test("releases concurrency without refunding daily usage", async () => {
    const store = createInMemoryAiQuotaStore({
      dailyUserRequests: 5,
      dailyOrganizationRequests: 5,
      maxConcurrentRequests: 1,
    });
    const first = await store.admit("user-1", "organization-1");
    assert.equal(first.allowed, true);
    const busy = await store.admit("user-2", "organization-1");
    assert.equal(busy.allowed, false);
    if (!busy.allowed) assert.equal(busy.reason, "CONCURRENCY");
    if (first.allowed) await store.release(first.leaseId);
    const next = await store.admit("user-2", "organization-1");
    assert.equal(next.allowed, true);
    const status = await store.getStatus("user-1", "organization-1");
    assert.equal(status.userRemaining, 4);
    assert.equal(status.organizationRemaining, 3);
    store.close();
  });
});
