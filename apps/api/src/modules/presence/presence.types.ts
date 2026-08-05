import {
  PresenceStatus,
  type PresenceStatusValue,
} from "@intouch/shared/memberships";

export { PresenceStatus };
export type { PresenceStatusValue };

export interface PresenceView {
  userId: string;
  status: PresenceStatusValue;
  lastSeenAt: Date | null;
}
