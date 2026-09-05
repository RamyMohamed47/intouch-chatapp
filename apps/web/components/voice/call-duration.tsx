"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const formatDuration = (elapsedSeconds: number) => {
  const hours = Math.floor(elapsedSeconds / 3_600);
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60);
  const seconds = elapsedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const accessibleDuration = (elapsedSeconds: number) => {
  const hours = Math.floor(elapsedSeconds / 3_600);
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60);
  const seconds = elapsedSeconds % 60;
  const parts = [
    hours > 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : null,
    minutes > 0 ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}` : null,
    `${seconds} ${seconds === 1 ? "second" : "seconds"}`,
  ].filter(Boolean);

  return parts.join(", ");
};

export function CallDuration({
  answeredAt,
  className,
}: {
  answeredAt: string;
  className?: string;
}) {
  const answeredAtMs = Date.parse(answeredAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [answeredAtMs]);

  if (!Number.isFinite(answeredAtMs)) return null;

  const elapsedSeconds = Math.max(0, Math.floor((now - answeredAtMs) / 1_000));

  return (
    <time
      aria-label={`Call duration ${accessibleDuration(elapsedSeconds)}`}
      className={cn("font-mono tabular-nums", className)}
      dateTime={`PT${elapsedSeconds}S`}
      suppressHydrationWarning
    >
      {formatDuration(elapsedSeconds)}
    </time>
  );
}
