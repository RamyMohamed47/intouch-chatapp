"use client";

import {
  NotificationStatus,
  type NotificationDto,
  type NotificationStatusValue,
} from "@intouch/shared/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NotificationItem, notificationHref } from "./notification-item";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/workspace/page-header";
import { notificationsApi } from "@/lib/api/notifications";
import { useNotifications } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

export function NotificationsPage() {
  const [status, setStatus] = useState<NotificationStatusValue>(
    NotificationStatus.ALL,
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useNotifications(status);
  const notifications =
    query.data?.pages.flatMap((page) => page.notifications) ?? [];
  const unreadCount = query.data?.pages[0]?.unreadCount ?? 0;
  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      notificationsApi.markRead(notificationId),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
  const select = (notification: NotificationDto) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    router.push(notificationHref(notification));
  };

  return (
    <>
      <PageHeader
        eyebrow="Activity inbox"
        title="Notifications"
        description="Invitations, direct messages, and reactions that need your attention."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={unreadCount === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck /> Mark all read
          </Button>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-4xl p-5 md:p-8 lg:p-10">
          <div className="mb-6 flex w-fit rounded-full border border-border bg-background/40 p-1">
            {[NotificationStatus.ALL, NotificationStatus.UNREAD].map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium transition-colors",
                    status === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === NotificationStatus.ALL
                    ? "All"
                    : `Unread (${unreadCount})`}
                </button>
              ),
            )}
          </div>

          {query.isPending ? (
            <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
              Loading notifications...
            </p>
          ) : query.isError ? (
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="w-full rounded-2xl border border-destructive/30 p-6 text-left text-sm text-destructive"
            >
              Notifications could not be loaded. Select to retry.
            </button>
          ) : notifications.length === 0 ? (
            <section className="grid min-h-[52vh] place-items-center rounded-[2rem] border border-dashed border-border bg-background/20 p-8 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  {status === NotificationStatus.UNREAD ? <Bell /> : <Inbox />}
                </span>
                <h2 className="mt-5 text-2xl font-semibold">
                  {status === NotificationStatus.UNREAD
                    ? "You are all caught up."
                    : "Your notification history is empty."}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  New invitations, direct messages, accepted invitations, and
                  reactions will appear here.
                </p>
              </div>
            </section>
          ) : (
            <div className="grid gap-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onSelect={select}
                />
              ))}
              {query.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  className="mx-auto mt-4 rounded-full"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {query.isFetchingNextPage
                    ? "Loading..."
                    : "Load older notifications"}
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
