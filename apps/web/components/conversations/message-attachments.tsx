"use client";

import { Download, FileText, Maximize2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AttachmentDto } from "@intouch/shared/uploads";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { uploadsApi } from "@/lib/api/uploads";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

const sizeLabel = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function Attachment({ attachment }: { attachment: AttachmentDto }) {
  const access = useQuery({
    queryKey: queryKeys.assets.access(attachment.id),
    queryFn: () => uploadsApi.access(attachment.id),
    staleTime: 8 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
  });

  if (attachment.kind === "IMAGE") {
    return (
      <Dialog>
        <DialogTrigger
          className="group/image relative overflow-hidden rounded-xl border border-border bg-muted"
          aria-label={`Open ${attachment.fileName}`}
        >
          {access.data ? (
            <img
              src={access.data.accessUrl}
              alt={attachment.fileName}
              loading="lazy"
              className="max-h-80 w-full object-contain"
            />
          ) : (
            <span className="grid h-36 place-items-center text-sm text-muted-foreground">
              {access.isError ? "Image unavailable" : "Loading image..."}
            </span>
          )}
          <span className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-full bg-background/80 opacity-0 backdrop-blur transition group-hover/image:opacity-100">
            <Maximize2 className="size-4" aria-hidden />
          </span>
        </DialogTrigger>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{attachment.fileName}</DialogTitle>
            <DialogDescription>{sizeLabel(attachment.size)}</DialogDescription>
          </DialogHeader>
          {access.data && (
            <img
              src={access.data.accessUrl}
              alt={attachment.fileName}
              className="max-h-[75dvh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/55 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <FileText className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {attachment.fileName}
        </span>
        <span className="text-xs text-muted-foreground">
          {sizeLabel(attachment.size)}
        </span>
      </span>
      <a
        href={access.data?.accessUrl}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!access.data}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          !access.data && "pointer-events-none opacity-50",
        )}
        aria-label={`Download ${attachment.fileName}`}
      >
        <Download aria-hidden />
      </a>
    </div>
  );
}

export function MessageAttachments({
  attachments,
}: {
  attachments: AttachmentDto[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <Attachment key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}
