"use client";

import { MonitorUp, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ParticipantVideo } from "@/components/voice/participant-video";
import type { ParticipantScreenShareTrack } from "@/lib/voice/provider";
import { cn } from "@/lib/utils";

export interface ScreenSharePresenter extends ParticipantScreenShareTrack {
  displayName: string;
  userId?: string;
}

export function ScreenShareStage({
  action,
  className,
  shares,
}: {
  action?: (share: ScreenSharePresenter) => ReactNode;
  className?: string;
  shares: ScreenSharePresenter[];
}) {
  const latest = shares.at(-1);
  const [selectedId, setSelectedId] = useState<string | null>(
    latest?.id ?? null,
  );
  const latestOrderRef = useRef(0);
  const selected =
    shares.find(({ id }) => id === selectedId) ?? latest ?? shares[0];

  useEffect(() => {
    if (!latest) {
      latestOrderRef.current = 0;
      setSelectedId(null);
      return;
    }
    if (
      latest.observedOrder > latestOrderRef.current ||
      !shares.some(({ id }) => id === selectedId)
    ) {
      setSelectedId(latest.id);
    }
    latestOrderRef.current = latest.observedOrder;
  }, [latest, selectedId, shares]);

  if (!selected) return null;

  return (
    <section aria-label="Screen sharing" className={cn("min-w-0", className)}>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic>
        {selected.displayName} is sharing a screen
      </p>
      <div className="relative aspect-video min-h-48 overflow-hidden rounded-[1.75rem] border border-primary/25 bg-black shadow-2xl">
        <ParticipantVideo
          displayName={selected.displayName}
          isLocal={selected.isLocal}
          mediaKind="screen"
          track={selected.track}
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pt-4 pb-10 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/25 text-primary-foreground backdrop-blur">
              <MonitorUp className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm">
                {selected.displayName}
                {selected.isLocal ? " (You)" : ""}
              </strong>
              <span className="block text-xs text-white/70">
                Presenting screen
              </span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {selected.hasAudio && (
              <Badge className="border-white/20 bg-black/45 text-white">
                <Volume2 aria-hidden="true" /> Shared audio
              </Badge>
            )}
            {action?.(selected)}
          </div>
        </div>
      </div>

      {shares.length > 1 && (
        <div
          className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1"
          aria-label="Shared screens"
        >
          {shares.map((share) => (
            <button
              key={share.id}
              type="button"
              aria-pressed={share.id === selected.id}
              aria-label={`View ${share.displayName}'s shared screen`}
              className={cn(
                "group relative aspect-video w-36 shrink-0 overflow-hidden rounded-xl border bg-black text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
                share.id === selected.id
                  ? "border-primary ring-1 ring-primary/60"
                  : "border-border hover:border-primary/60",
              )}
              onClick={() => setSelectedId(share.id)}
            >
              <ParticipantVideo
                displayName={share.displayName}
                isLocal={share.isLocal}
                mediaKind="screen"
                track={share.track}
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                {share.displayName}
                {share.isLocal ? " (You)" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
