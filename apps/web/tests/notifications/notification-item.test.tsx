import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  NotificationItem,
  notificationHref,
} from "@/components/notifications/notification-item";
import type { NotificationDto } from "@intouch/shared/notifications";

const notification: NotificationDto = {
  id: "507f1f77bcf86cd799439011",
  type: "DIRECT_MESSAGE_RECEIVED",
  actor: {
    id: "507f1f77bcf86cd799439012",
    username: "lina",
    displayName: "Lina Hassan",
  },
  organization: {
    id: "507f1f77bcf86cd799439013",
    name: "Northstar",
  },
  conversationId: "507f1f77bcf86cd799439014",
  latestMessageId: "507f1f77bcf86cd799439015",
  messageCount: 3,
  readAt: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  lastActivityAt: "2026-08-29T00:01:00.000Z",
};

describe("NotificationItem", () => {
  it("renders grouped DM copy and exposes unread state", async () => {
    const onSelect = vi.fn();
    render(
      <NotificationItem notification={notification} onSelect={onSelect} />,
    );
    expect(
      screen.getByText("Lina Hassan sent 3 direct messages"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(notification);
  });

  it("builds an exact-message DM destination", () => {
    expect(notificationHref(notification)).toBe(
      "/app/507f1f77bcf86cd799439013/direct-messages/507f1f77bcf86cd799439014?messageId=507f1f77bcf86cd799439015",
    );
  });
});
