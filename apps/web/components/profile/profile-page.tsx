"use client";

import { Camera, RefreshCw, Trash2, Upload } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { UploadPurpose } from "@intouch/shared/uploads";

import { PageHeader } from "@/components/workspace/page-header";
import { UserAvatar } from "@/components/users/user-avatar";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { uploadsApi } from "@/lib/api/uploads";
import { useAuth } from "@/lib/auth/provider";
import { prepareAvatarImage } from "@/lib/uploads/avatar-image";
import { useUploadQueue } from "@/lib/uploads/use-upload-queue";

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const queue = useUploadQueue({
    purpose: UploadPurpose.AVATAR,
    maximumFiles: 1,
  });
  const item = queue.items[0];
  const activate = useMutation({
    mutationFn: (uploadId: string) => uploadsApi.setAvatar(uploadId),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      queue.clear();
    },
  });
  const remove = useMutation({
    mutationFn: () => uploadsApi.removeAvatar(),
    onSuccess: (updatedUser) => updateUser(updatedUser),
  });

  if (!user) return null;

  const selectFile = async (file?: File) => {
    if (!file) return;
    setProcessingError(null);
    queue.clear({ cancelUploads: true });
    try {
      queue.addFiles([await prepareAvatarImage(file)]);
    } catch (error) {
      setProcessingError(
        error instanceof Error ? error.message : "Avatar processing failed",
      );
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        eyebrow="Your profile"
        title="Profile picture"
        description="Choose how teammates recognize you across InTouch."
      />
      <div className="mx-auto grid w-full max-w-3xl gap-6 p-5 md:p-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card/80 shadow-xl backdrop-blur-xl">
          <div className="relative h-36 bg-[radial-gradient(circle_at_20%_20%,var(--brand-orange),transparent_35%),radial-gradient(circle_at_80%_10%,var(--brand-blue),transparent_42%)] opacity-80" />
          <div className="relative -mt-16 p-6 md:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <UserAvatar
                displayName={user.displayName}
                avatarAssetId={user.avatarAssetId}
                avatarUrl={user.avatarUrl}
                className="size-28 border-4 border-card shadow-2xl"
              />
              <div className="min-w-0 flex-1 pb-1">
                <h2 className="truncate text-2xl font-semibold">
                  {user.displayName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  @{user.username}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-background/45 p-5">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => void selectFile(event.target.files?.[0])}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => inputRef.current?.click()}>
                  <Camera aria-hidden />
                  Choose photo
                </Button>
                {user.avatarAssetId && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate()}
                  >
                    <Trash2 aria-hidden />
                    Remove custom photo
                  </Button>
                )}
              </div>

              {item && (
                <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border p-4">
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt="New avatar preview"
                      className="size-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-2xl bg-muted">
                      <Upload aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.file.name}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-[width]"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.status === "completed"
                        ? "Ready to apply"
                        : `${item.progress}% uploaded`}
                    </p>
                  </div>
                  {item.status === "error" ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Retry avatar upload"
                      onClick={() => queue.retry(item.localId)}
                    >
                      <RefreshCw aria-hidden />
                    </Button>
                  ) : (
                    item.completed && (
                      <Button
                        type="button"
                        disabled={activate.isPending}
                        onClick={() =>
                          activate.mutate(item.completed!.uploadId)
                        }
                      >
                        Apply
                      </Button>
                    )
                  )}
                </div>
              )}
              {(processingError ||
                item?.error ||
                activate.error ||
                remove.error) && (
                <FormError className="mt-4">
                  {processingError ??
                    item?.error ??
                    activate.error?.message ??
                    remove.error?.message}
                </FormError>
              )}
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Images are cropped to a private 512 by 512 WebP before upload.
                JPEG, PNG, and WebP sources are supported.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
