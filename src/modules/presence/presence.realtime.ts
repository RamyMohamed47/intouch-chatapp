import type { PresenceView } from "./presence.types.js";

export interface PresenceRealtime {
  presenceUpdated(
    organizationIds: readonly string[],
    presence: PresenceView,
  ): void;
}

export const createNoopPresenceRealtime = (): PresenceRealtime => ({
  presenceUpdated() {},
});
