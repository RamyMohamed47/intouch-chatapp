export const PresenceStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
} as const;

export type PresenceStatusValue =
  (typeof PresenceStatus)[keyof typeof PresenceStatus];

export interface PresenceView {
  userId: string;
  status: PresenceStatusValue;
  lastSeenAt: Date | null;
}
