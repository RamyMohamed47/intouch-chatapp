"use client";

import type { OrganizationSearchResultDto } from "@intouch/shared/search";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Hash,
  Lock,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { PresenceIndicator } from "@/components/presence/presence-indicator";
import { UserAvatar } from "@/components/users/user-avatar";
import { conversationsApi } from "@/lib/api/conversations";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

const resultHref = (
  organizationId: string,
  result: Exclude<OrganizationSearchResultDto, { kind: "PERSON" }>,
) => {
  if (result.kind === "CHANNEL") {
    return `/app/${organizationId}/channels/${result.id}`;
  }
  const segment =
    result.conversation.type === "CHANNEL" ? "channels" : "direct-messages";
  return `/app/${organizationId}/${segment}/${result.conversation.id}?messageId=${result.id}`;
};

export function SearchResults({
  organizationId,
  results,
  compact = false,
  onNavigate,
}: {
  organizationId: string;
  results: OrganizationSearchResultDto[];
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createDirectMessage = useMutation({
    mutationFn: (recipientUserId: string) =>
      conversationsApi.createDirectMessage(organizationId, { recipientUserId }),
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.directMessages(organizationId),
      });
      onNavigate?.();
      router.push(`/app/${organizationId}/direct-messages/${conversation.id}`);
    },
  });

  const navigate = (result: OrganizationSearchResultDto) => {
    if (result.kind === "PERSON") {
      if (result.directConversationId) {
        onNavigate?.();
        router.push(
          `/app/${organizationId}/direct-messages/${result.directConversationId}`,
        );
      } else {
        createDirectMessage.mutate(result.user.id);
      }
      return;
    }
    onNavigate?.();
    router.push(resultHref(organizationId, result));
  };

  return (
    <div className="grid gap-2" role="list">
      {results.map((result) => {
        const title =
          result.kind === "MESSAGE"
            ? result.sender.displayName
            : result.kind === "CHANNEL"
              ? result.name
              : result.user.displayName;
        return (
          <button
            key={`${result.kind}:${result.kind === "PERSON" ? result.user.id : result.id}`}
            type="button"
            role="listitem"
            disabled={createDirectMessage.isPending}
            onClick={() => navigate(result)}
            className={cn(
              "group flex w-full items-start gap-3 rounded-2xl border border-transparent bg-background/25 p-3 text-left transition hover:border-primary/25 hover:bg-primary/5 focus-visible:border-primary/50 focus-visible:outline-none disabled:opacity-60",
              !compact && "p-4",
            )}
          >
            {result.kind === "PERSON" ? (
              <span className="relative mt-0.5 shrink-0">
                <UserAvatar
                  displayName={result.user.displayName}
                  avatarAssetId={result.user.avatarAssetId}
                  avatarUrl={result.user.avatarUrl}
                />
                <PresenceIndicator
                  displayName={result.user.displayName}
                  status={result.user.status}
                  lastSeenAt={result.user.lastSeenAt}
                  variant="compact"
                />
              </span>
            ) : (
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                {result.kind === "MESSAGE" ? (
                  <MessageCircle className="size-4" />
                ) : result.visibility === "PRIVATE" ? (
                  <Lock className="size-4" />
                ) : (
                  <Hash className="size-4" />
                )}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <strong className="truncate text-sm">{title}</strong>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  {result.kind === "MESSAGE"
                    ? result.conversation.label
                    : result.kind === "CHANNEL"
                      ? "Channel"
                      : result.role.toLowerCase()}
                </span>
              </span>
              {result.kind === "MESSAGE" && (
                <span className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {result.snippet.map((segment, index) =>
                    segment.matched ? (
                      <mark
                        key={`${segment.text}:${index}`}
                        className="rounded bg-brand-orange/20 px-0.5 text-foreground"
                      >
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={`${segment.text}:${index}`}>
                        {segment.text}
                      </span>
                    ),
                  )}
                </span>
              )}
              {result.kind === "CHANNEL" && (
                <span className="mt-1 block text-xs capitalize text-muted-foreground">
                  {result.visibility.toLowerCase()} conversation
                </span>
              )}
              {result.kind === "PERSON" && (
                <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <UserRound className="size-3" /> @{result.user.username}
                </span>
              )}
            </span>
            <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
          </button>
        );
      })}
      {createDirectMessage.isError && (
        <p className="px-3 text-sm text-destructive" role="alert">
          {createDirectMessage.error.message}
        </p>
      )}
    </div>
  );
}
