import type { MembershipJoinedEvent } from "@intouch/shared/realtime";

export interface MembershipRealtime {
  membershipJoined(event: MembershipJoinedEvent): void;
}

export const createNoopMembershipRealtime = (): MembershipRealtime => ({
  membershipJoined() {},
});
