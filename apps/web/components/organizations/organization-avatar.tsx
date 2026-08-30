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

export function OrganizationAvatar({
  name,
  logoAssetId,
  className,
}: {
  name: string;
  logoAssetId: string | null;
  className?: string;
}) {
  const asset = useQuery({
    queryKey: queryKeys.assets.access(logoAssetId ?? "none"),
    queryFn: () => uploadsApi.access(logoAssetId ?? ""),
    enabled: Boolean(logoAssetId),
    staleTime: 8 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
  });

  return (
    <Avatar className={className}>
      {asset.data?.accessUrl && (
        <AvatarImage src={asset.data.accessUrl} alt="" />
      )}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
