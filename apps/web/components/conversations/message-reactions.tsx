"use client";

import type { MessageDto } from "@intouch/shared/messages";
import { useInfiniteQuery } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import { useState } from "react";

import { EmojiPickerPanel } from "@/components/conversations/emoji-picker";
import { UserAvatar } from "@/components/users/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { messagesApi } from "@/lib/api/messages";
import { queryKeys } from "@/lib/query/keys";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"] as const;

function ReactionSummary({
  count,
  disabled,
  emoji,
  messageId,
  selected,
  onToggle,
}: {
  count: number;
  disabled: boolean;
  emoji: string;
  messageId: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-border bg-muted/40">
      <button
        type="button"
        className="grid min-h-7 min-w-8 place-items-center px-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[selected=true]:bg-primary/15"
        data-selected={selected}
        aria-pressed={selected}
        aria-label={`${selected ? "Remove" : "Add"} ${emoji} reaction`}
        disabled={disabled}
        onClick={onToggle}
      >
        {emoji}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="min-h-7 min-w-7 border-l border-border px-2 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View ${count} ${emoji} reactions`}
        >
          {count}
        </PopoverTrigger>
        <ReactionUsers
          emoji={emoji}
          messageId={messageId}
          open={open}
          total={count}
        />
      </Popover>
    </div>
  );
}

function ReactionUsers({
  emoji,
  messageId,
  open,
  total,
}: {
  emoji: string;
  messageId: string;
  open: boolean;
  total: number;
}) {
  const users = useInfiniteQuery({
    queryKey: queryKeys.conversations.reactionUsers(messageId, emoji),
    queryFn: ({ pageParam }) =>
      messagesApi.listReactionUsers(messageId, emoji, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: open,
  });
  const reactors =
    users.data?.pages
      .flatMap((page) => page.users)
      .filter(
        (user, index, list) =>
          list.findIndex((candidate) => candidate.id === user.id) === index,
      ) ?? [];

  return (
    <PopoverContent align="start" className="w-72">
      <PopoverHeader>
        <PopoverTitle>{emoji} Reactions</PopoverTitle>
        <PopoverDescription>
          {total} member{total === 1 ? "" : "s"} reacted.
        </PopoverDescription>
      </PopoverHeader>
      <div className="grid max-h-64 gap-2 overflow-y-auto">
        {users.isPending && (
          <p className="py-3 text-sm text-muted-foreground">
            Loading members...
          </p>
        )}
        {users.isError && (
          <button
            type="button"
            className="rounded-lg border border-destructive/30 p-2 text-left text-sm text-destructive"
            onClick={() => void users.refetch()}
          >
            Members could not be loaded. Select to retry.
          </button>
        )}
        {reactors.map((user) => (
          <div key={user.id} className="flex items-center gap-2">
            <UserAvatar
              className="size-7"
              displayName={user.displayName}
              avatarAssetId={user.avatarAssetId}
              avatarUrl={user.avatarUrl}
            />
            <span className="min-w-0 truncate text-sm">{user.displayName}</span>
          </div>
        ))}
        {users.hasNextPage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={users.isFetchingNextPage}
            onClick={() => void users.fetchNextPage()}
          >
            {users.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        )}
      </div>
    </PopoverContent>
  );
}

export function MessageReactionSummaries({
  message,
  disabled,
  onToggle,
}: {
  message: MessageDto;
  disabled: boolean;
  onToggle: (emoji: string) => void;
}) {
  if (message.deletedAt || message.reactions.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Message reactions">
      {message.reactions.map((reaction) => {
        const selected = message.currentUserReaction === reaction.emoji;
        return (
          <ReactionSummary
            key={reaction.emoji}
            count={reaction.count}
            disabled={disabled}
            emoji={reaction.emoji}
            messageId={message.id}
            selected={selected}
            onToggle={() => onToggle(reaction.emoji)}
          />
        );
      })}
    </div>
  );
}

export function MessageReactionPicker({
  currentReaction,
  disabled,
  onSelect,
}: {
  currentReaction: string | null;
  disabled: boolean;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const select = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Add reaction"
            disabled={disabled}
          />
        }
      >
        <SmilePlus />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-[calc(100vw-2rem)] p-2"
      >
        <PopoverHeader className="px-1 pb-1">
          <PopoverTitle>React to message</PopoverTitle>
          <PopoverDescription>
            Selecting another emoji replaces your current reaction.
          </PopoverDescription>
        </PopoverHeader>
        <div
          className="flex flex-wrap gap-1 px-1 pb-2"
          aria-label="Quick reactions"
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="grid size-9 place-items-center rounded-lg text-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:bg-primary/15"
              data-selected={currentReaction === emoji}
              aria-pressed={currentReaction === emoji}
              aria-label={`React with ${emoji}`}
              onClick={() => select(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <EmojiPickerPanel onSelect={select} />
      </PopoverContent>
    </Popover>
  );
}
