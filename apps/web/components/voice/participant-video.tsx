"use client";

import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function ParticipantVideo({
  className,
  displayName,
  isLocal = false,
  track,
}: {
  className?: string;
  displayName: string;
  isLocal?: boolean;
  track: LocalVideoTrack | RemoteVideoTrack;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    track.attach(video);
    return () => {
      track.detach(video);
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      aria-label={`${displayName}'s camera`}
      autoPlay
      muted
      playsInline
      className={cn(
        "size-full bg-black object-cover",
        isLocal && "-scale-x-100",
        className,
      )}
    />
  );
}
