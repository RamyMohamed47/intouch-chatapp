"use client";

import { ConnectionState } from "livekit-client";
import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Radio,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useConversation } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";
import { useVoice } from "@/lib/voice/provider";

export function VoiceSessionPanel({
  variant,
  onNavigate,
}: {
  variant: "sidebar" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const voice = useVoice();
  const conversation = useConversation(
    voice.activeSession?.conversationId ?? "",
  );
  const session = voice.activeSession;

  if (!session) return null;

  const href =
    session.kind === "VOICE_CHANNEL"
      ? `/app/${session.organizationId}/channels/${session.conversationId}`
      : `/app/${session.organizationId}/direct-messages/${session.conversationId}`;
  if (pathname === href) return null;

  const sessionName =
    conversation.data?.type === "CHANNEL"
      ? conversation.data.name
      : conversation.data?.type === "DIRECT"
        ? conversation.data.peer.displayName
        : session.kind === "CALL"
          ? "Voice call"
          : "Voice channel";
  const connected = voice.connectionState === ConnectionState.Connected;
  const status = connected
    ? `${voice.participantIdentities.length} connected · ${voice.connectionQuality.toLowerCase()}`
    : "Connecting...";
  const visibleStatus = voice.error ?? status;

  const controls = (
    <>
      {voice.isPlaybackBlocked && variant === "mobile" && (
        <Button
          size="icon"
          variant="outline"
          disabled={voice.isTransitioning}
          aria-label="Enable call audio"
          onClick={() => void voice.enablePlayback()}
        >
          <Volume2 />
        </Button>
      )}
      <Button
        className={cn(variant === "sidebar" && "min-w-0")}
        size={variant === "sidebar" ? "sm" : "icon"}
        variant="outline"
        disabled={voice.isTransitioning}
        aria-label={voice.isMuted ? "Unmute microphone" : "Mute microphone"}
        onClick={() => void voice.toggleMute()}
      >
        {voice.isMuted ? <MicOff /> : <Mic />}
        {variant === "sidebar" && (
          <span className="truncate">{voice.isMuted ? "Unmute" : "Mute"}</span>
        )}
      </Button>
      <Button
        className={cn(variant === "sidebar" && "min-w-0")}
        size={variant === "sidebar" ? "sm" : "icon"}
        variant="outline"
        disabled={voice.isTransitioning}
        aria-label={voice.isDeafened ? "Undeafen" : "Deafen"}
        onClick={() => voice.toggleDeafen()}
      >
        {voice.isDeafened ? <HeadphoneOff /> : <Headphones />}
        {variant === "sidebar" && (
          <span className="truncate">
            {voice.isDeafened ? "Listen" : "Deafen"}
          </span>
        )}
      </Button>
      <Button
        size={variant === "sidebar" ? "icon-sm" : "icon"}
        variant="destructive"
        disabled={voice.isTransitioning}
        aria-label="Leave voice session"
        onClick={() => void voice.endSession()}
      >
        <PhoneOff />
      </Button>
    </>
  );

  if (variant === "mobile") {
    return (
      <aside
        aria-label="Active voice session controls"
        className="flex min-w-0 shrink-0 items-center gap-2 border-t border-primary/25 bg-card/95 px-3 py-2 shadow-[0_-12px_32px_rgb(0_0_0/0.18)] backdrop-blur-xl md:hidden"
      >
        <Link
          href={href}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            {session.kind === "CALL" ? <Phone /> : <Radio />}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs">{sessionName}</strong>
            <span
              className={cn(
                "block truncate text-[10px] text-muted-foreground",
                voice.error && "text-destructive",
              )}
              role={voice.error ? "alert" : undefined}
            >
              {visibleStatus}
            </span>
          </span>
        </Link>
        {controls}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Active voice session controls"
      className="mt-2 min-w-0 shrink-0 rounded-2xl border border-primary/25 bg-primary/5 p-3"
    >
      <Link
        href={href}
        onClick={onNavigate}
        className="flex min-w-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {session.kind === "CALL" ? <Phone /> : <Radio />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-primary">
            {session.kind === "CALL" ? "Voice call" : "Voice connected"}
          </span>
          <strong className="block truncate text-xs">{sessionName}</strong>
          <span
            className={cn(
              "block truncate text-[10px] text-muted-foreground",
              voice.error && "text-destructive",
            )}
            role={voice.error ? "alert" : undefined}
          >
            {visibleStatus}
          </span>
        </span>
      </Link>
      {voice.isPlaybackBlocked && (
        <Button
          className="mt-3 w-full"
          size="sm"
          variant="outline"
          disabled={voice.isTransitioning}
          onClick={() => void voice.enablePlayback()}
        >
          <Volume2 /> Enable audio
        </Button>
      )}
      <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5">
        {controls}
      </div>
    </aside>
  );
}
