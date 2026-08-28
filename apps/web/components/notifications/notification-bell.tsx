"use client";

import {
  NotificationStatus,
  type NotificationDto,
} from "@intouch/shared/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";

import { NotificationItem, notificationHref } from "./notification-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { notificationsApi } from "@/lib/api/notifications";
import { useNotifications } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

function BellButton({
  unreadCount,
  className,
  ...props
}: ComponentProps<typeof Button> & { unreadCount: number }) {
  return (
    <Button
      {...props}
      type="button"
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      aria-label={`Notifications${
        unreadCount ? `, ${unreadCount} unread` : ""
      }`}
    >
      <Bell />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px]">
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useNotifications(NotificationStatus.ALL, 10);
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
    onClose();
    router.push(notificationHref(notification));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {unreadCount ? `${unreadCount} unread` : "You are all caught up"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={unreadCount === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck /> Mark all read
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {query.isPending ? (
          <p className="p-5 text-center text-sm text-muted-foreground">
            Loading notifications...
          </p>
        ) : query.isError ? (
          <button
            type="button"
            className="w-full rounded-2xl border border-destructive/30 p-5 text-sm text-destructive"
            onClick={() => void query.refetch()}
          >
            Notifications could not be loaded. Select to retry.
          </button>
        ) : notifications.length === 0 ? (
          <div className="grid min-h-52 place-items-center p-6 text-center">
            <div>
              <Inbox className="mx-auto size-7 text-primary" />
              <p className="mt-3 text-sm font-medium">Nothing new yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Invitations, direct messages, and reactions will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-1">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onSelect={select}
              />
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full"
          onClick={() => {
            onClose();
            router.push("/app/notifications");
          }}
        >
          View all notifications
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const query = useNotifications(NotificationStatus.ALL, 10);
  const unreadCount = query.data?.pages[0]?.unreadCount ?? 0;

  return (
    <>
      <div className="hidden md:block">
        <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
          <PopoverTrigger render={<BellButton unreadCount={unreadCount} />} />
          <PopoverContent
            align="end"
            side="top"
            className="h-[min(32rem,75vh)] w-[25rem] overflow-hidden p-0"
          >
            <PopoverHeader className="sr-only">
              <PopoverTitle>Notifications</PopoverTitle>
              <PopoverDescription>
                Your recent account activity.
              </PopoverDescription>
            </PopoverHeader>
            <NotificationPanel onClose={() => setDesktopOpen(false)} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger render={<BellButton unreadCount={unreadCount} />} />
          <SheetContent side="right" className="w-[min(92vw,25rem)] gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>Your recent account activity.</SheetDescription>
            </SheetHeader>
            <NotificationPanel onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
