"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChatWallpaperId,
  type ChatWallpaperDto,
  type ChatWallpaperIdType,
} from "@intouch/shared/chat-wallpapers";

import {
  ChatWallpaperSurface,
  wallpaperPresets,
  type WallpaperCategory,
} from "@/components/conversations/chat-wallpaper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { chatWallpapersApi } from "@/lib/api/chat-wallpapers";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

const categories: readonly WallpaperCategory[] = [
  "Doodles",
  "Abstract",
  "Scenery",
];

export function ChatWallpaperDialog({
  conversationId,
  wallpaper,
}: {
  conversationId: string;
  wallpaper: ChatWallpaperDto;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [wallpaperId, setWallpaperId] = useState<ChatWallpaperIdType>(
    wallpaper.wallpaperId,
  );
  const [dimming, setDimming] = useState(wallpaper.dimming);

  useEffect(() => {
    if (!open) return;
    setWallpaperId(wallpaper.wallpaperId);
    setDimming(wallpaper.dimming);
  }, [open, wallpaper.dimming, wallpaper.wallpaperId]);

  const draft = {
    wallpaperId,
    dimming: wallpaperId === ChatWallpaperId.NONE ? 0 : dimming,
  };

  const applyConversation = useMutation({
    mutationFn: () =>
      chatWallpapersApi.setForConversation(conversationId, draft),
    onSuccess: (next) => {
      queryClient.setQueryData(
        queryKeys.chatWallpapers.conversation(conversationId),
        next,
      );
      setOpen(false);
    },
  });
  const applyDefault = useMutation({
    mutationFn: () => chatWallpapersApi.setDefault(draft),
    onSuccess: async (next) => {
      queryClient.setQueryData(queryKeys.chatWallpapers.default, next);
      if (wallpaper.source === "DEFAULT") {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.chatWallpapers.conversation(conversationId),
        });
      }
      setOpen(false);
    },
  });
  const resetConversation = useMutation({
    mutationFn: () => chatWallpapersApi.resetConversation(conversationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatWallpapers.conversation(conversationId),
      });
      setOpen(false);
    },
  });
  const pending =
    applyConversation.isPending ||
    applyDefault.isPending ||
    resetConversation.isPending;
  const error =
    applyConversation.error ?? applyDefault.error ?? resetConversation.error;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Choose chat wallpaper"
          />
        }
      >
        <ImageIcon />
      </DialogTrigger>
      <DialogContent className="max-h-[min(92dvh,860px)] max-w-4xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>Chat wallpaper</DialogTitle>
          <DialogDescription>
            Make this conversation feel personal without changing what anyone
            else sees.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <button
              type="button"
              aria-pressed={wallpaperId === ChatWallpaperId.NONE}
              onClick={() => setWallpaperId(ChatWallpaperId.NONE)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                wallpaperId === ChatWallpaperId.NONE
                  ? "border-primary bg-primary/10 ring-2 ring-primary/15"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="grid size-12 place-items-center rounded-xl border border-border bg-background">
                <ImageIcon className="size-5 text-muted-foreground" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Plain</span>
                <span className="text-xs text-muted-foreground">
                  Use the current theme background.
                </span>
              </span>
            </button>

            {categories.map((category) => (
              <section key={category} aria-labelledby={`wallpaper-${category}`}>
                <h3
                  id={`wallpaper-${category}`}
                  className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {category}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {wallpaperPresets
                    .filter((preset) => preset.category === category)
                    .map((preset) => {
                      const selected = wallpaperId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${preset.label}: ${preset.description}`}
                          onClick={() => setWallpaperId(preset.id)}
                          className={cn(
                            "overflow-hidden rounded-2xl border bg-card text-left transition hover:-translate-y-0.5 hover:border-primary/50",
                            selected
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border",
                          )}
                        >
                          <span className="relative block aspect-[4/3] overflow-hidden bg-background">
                            <ChatWallpaperSurface
                              wallpaper={{
                                wallpaperId: preset.id,
                                dimming: 15,
                              }}
                              preview
                            />
                          </span>
                          <span className="block truncate px-2.5 py-2 text-xs font-medium">
                            {preset.label}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-0 lg:self-start">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-background shadow-xl">
              <ChatWallpaperSurface wallpaper={draft} />
              <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-4">
                <div className="max-w-[82%] rounded-2xl border border-border bg-card/85 p-3 text-xs shadow-sm backdrop-blur-md">
                  This background stays private to you.
                </div>
                <div className="ml-auto max-w-[82%] rounded-2xl bg-primary/90 p-3 text-xs text-primary-foreground shadow-sm backdrop-blur-md">
                  Make every conversation feel at home.
                </div>
              </div>
            </div>

            <label className="mt-5 block" htmlFor="wallpaper-dimming">
              <span className="flex items-center justify-between text-sm font-medium">
                Dimming
                <span className="font-mono text-xs text-muted-foreground">
                  {draft.dimming}%
                </span>
              </span>
              <input
                id="wallpaper-dimming"
                name="dimming"
                aria-label="Dimming"
                type="range"
                min="0"
                max="80"
                step="1"
                value={draft.dimming}
                disabled={wallpaperId === ChatWallpaperId.NONE}
                onChange={(event) => setDimming(Number(event.target.value))}
                className="mt-3 w-full accent-primary disabled:opacity-40"
              />
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                Increase dimming when message text needs more contrast.
              </span>
            </label>
          </aside>
        </div>

        {error && (
          <div className="px-6 pb-2">
            <FormError>{error.message}</FormError>
          </div>
        )}
        <DialogFooter className="sticky bottom-0 m-0 border-t border-border bg-popover/95 px-6 py-4 backdrop-blur-xl">
          {wallpaper.source === "CONVERSATION" && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => resetConversation.mutate()}
              className="sm:mr-auto"
            >
              Use my default
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => applyDefault.mutate()}
          >
            Set as default
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => applyConversation.mutate()}
          >
            Apply to this chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
