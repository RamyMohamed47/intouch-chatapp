"use client";

import type { PresenceStatusValue } from "@intouch/shared/memberships";
import { useEffect, useState } from "react";

import { AvatarBadge } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PresencePresentation {
  accessibleLabel: string;
  label: string;
}

const relativeTime = (lastSeenAt: string, now: number, locale?: string) => {
  const lastSeen = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeen)) return null;

  const elapsedSeconds = Math.max(0, Math.floor((now - lastSeen) / 1_000));
  if (elapsedSeconds < 60) return "just now";

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (elapsedSeconds < 3_600) {
    return formatter.format(-Math.floor(elapsedSeconds / 60), "minute");
  }
  if (elapsedSeconds < 86_400) {
    return formatter.format(-Math.floor(elapsedSeconds / 3_600), "hour");
  }
  return formatter.format(-Math.floor(elapsedSeconds / 86_400), "day");
};

export const getPresencePresentation = ({
  displayName,
  lastSeenAt,
  locale,
  now = Date.now(),
  status,
}: {
  displayName: string;
  lastSeenAt: string | null;
  locale?: string;
  now?: number;
  status: PresenceStatusValue;
}): PresencePresentation => {
  if (status === "ONLINE") {
    return { accessibleLabel: `${displayName} is online`, label: "Online" };
  }

  const relative = lastSeenAt ? relativeTime(lastSeenAt, now, locale) : null;
  if (!relative) {
    return { accessibleLabel: `${displayName} is offline`, label: "Offline" };
  }

  return {
    accessibleLabel: `${displayName} was last seen ${relative}`,
    label: `Last seen ${relative}`,
  };
};

export function PresenceIndicator({
  className,
  displayName,
  lastSeenAt,
  status,
  variant = "label",
}: {
  className?: string;
  displayName: string;
  lastSeenAt: string | null;
  status: PresenceStatusValue;
  variant?: "compact" | "label";
}) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (status === "ONLINE" || !lastSeenAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [lastSeenAt, status]);

  const presentation = getPresencePresentation({
    displayName,
    lastSeenAt,
    now,
    status,
  });
  const dotClassName =
    status === "ONLINE" ? "bg-status" : "bg-muted-foreground";

  if (variant === "compact") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <AvatarBadge
              aria-label={presentation.accessibleLabel}
              className={cn(dotClassName, className)}
              role="status"
            />
          }
        />
        <TooltipContent>{presentation.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span
      aria-atomic="true"
      aria-label={presentation.accessibleLabel}
      aria-live="polite"
      className={cn("inline-flex items-center gap-1.5", className)}
      role="status"
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", dotClassName)}
      />
      <span>{presentation.label}</span>
    </span>
  );
}
