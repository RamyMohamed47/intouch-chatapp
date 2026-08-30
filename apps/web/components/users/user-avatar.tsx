"use client";

import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadsApi } from "@/lib/api/uploads";
import { queryKeys } from "@/lib/query/keys";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export function UserAvatar({
  displayName,
  avatarAssetId,
  avatarUrl,
  size = "default",
  className,
}: {
  displayName: string;
  avatarAssetId?: string | null;
  avatarUrl?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const asset = useQuery({
    queryKey: queryKeys.assets.access(avatarAssetId ?? "none"),
    queryFn: () => uploadsApi.access(avatarAssetId ?? ""),
    enabled: Boolean(avatarAssetId),
    staleTime: 8 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
  });
  const source = asset.data?.accessUrl ?? avatarUrl;

  return (
    <Avatar size={size} className={className}>
      {source && <AvatarImage src={source} alt="" />}
      <AvatarFallback>{initials(displayName)}</AvatarFallback>
    </Avatar>
  );
}
