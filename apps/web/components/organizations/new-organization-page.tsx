"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Globe2,
  Lock,
  RefreshCw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type SubmitEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrganizationSchema } from "@intouch/shared/organizations";
import { UploadPurpose } from "@intouch/shared/uploads";

import { PageHeader } from "@/components/workspace/page-header";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { organizationsApi } from "@/lib/api/organizations";
import { queryKeys } from "@/lib/query/keys";
import { prepareSquareImage } from "@/lib/uploads/square-image";
import { useUploadQueue } from "@/lib/uploads/use-upload-queue";
import { getFormString } from "@/lib/utils";

export function NewOrganizationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const logoQueue = useUploadQueue({
    purpose: UploadPurpose.ORGANIZATION_LOGO,
    maximumFiles: 1,
  });
  const logo = logoQueue.items[0];
  const createOrganization = useMutation({
    mutationFn: (input: Parameters<typeof organizationsApi.create>[0]) =>
      organizationsApi.create(input),
    onSuccess: async (organization) => {
      logoQueue.clear();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.all,
      });
      router.push(`/app/${organization.id}`);
    },
  });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = createOrganizationSchema.safeParse({
      name: getFormString(form, "name"),
      ...(logo?.completed ? { logoUploadId: logo.completed.uploadId } : {}),
      visibility: getFormString(form, "visibility") as "PRIVATE" | "PUBLIC",
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Workspace details are invalid",
      );
      return;
    }
    setError(null);
    createOrganization.mutate(parsed.data, {
      onError: (requestError) =>
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Workspace could not be created",
        ),
    });
  };

  const selectLogo = async (file?: File) => {
    if (!file) return;
    setProcessingError(null);
    logoQueue.clear({ cancelUploads: true });
    try {
      logoQueue.addFiles([await prepareSquareImage(file, "organization.webp")]);
    } catch (processingFailure) {
      setProcessingError(
        processingFailure instanceof Error
          ? processingFailure.message
          : "Logo processing failed",
      );
    }
  };

  const logoIsNotReady = Boolean(logo && !logo.completed);

  return (
    <>
      <PageHeader
        eyebrow="New organization"
        title="Create a place for focused work"
        description="Start with the essentials. Categories and channels come next."
        actions={
          <LinkButton variant="ghost" href="/app">
            <ArrowLeft /> Cancel
          </LinkButton>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto p-5 md:p-8 lg:p-10">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_1.15fr]">
          <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/10 p-7 md:p-9">
            <div className="absolute -right-24 -bottom-24 size-72 rounded-full border-[4rem] border-primary/10" />
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Building2 />
            </span>
            <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              One clear starting point
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Give the team a shared center of gravity.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              You become the owner automatically. Once created, shape the
              workspace with categories, public rooms, and private channels.
            </p>
            <div className="relative mt-10 grid gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/25 p-4">
                <Lock className="size-4 text-primary" />
                <span className="text-sm">Private by default</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/25 p-4">
                <Globe2 className="size-4 text-primary" />
                <span className="text-sm">Public when discovery matters</span>
              </div>
            </div>
          </section>

          <form
            onSubmit={submit}
            className="rounded-[2rem] border border-border bg-background/35 p-7 md:p-9"
          >
            <h2 className="text-xl font-semibold">Workspace details</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              These fields mirror the organization contract used by the API.
            </p>
            <div className="mt-8 grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="name">Organization name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Northstar"
                  autoFocus
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="organization-logo">Organization logo</Label>
                <input
                  ref={logoInputRef}
                  id="organization-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => void selectLogo(event.target.files?.[0])}
                />
                {!logo ? (
                  <button
                    type="button"
                    className="flex min-h-28 items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/30 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Camera className="size-5 text-primary" aria-hidden />
                    Choose an optional logo
                  </button>
                ) : (
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/30 p-4">
                    {logo.previewUrl && (
                      <img
                        src={logo.previewUrl}
                        alt="Organization logo preview"
                        className="size-16 rounded-2xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {logo.file.name}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-[width]"
                          style={{ width: `${logo.progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {logo.completed
                          ? "Ready to use"
                          : `${logo.progress}% uploaded`}
                      </p>
                    </div>
                    {logo.status === "error" && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Retry logo upload"
                        onClick={() => logoQueue.retry(logo.localId)}
                      >
                        <RefreshCw aria-hidden />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove selected logo"
                      onClick={() => logoQueue.remove(logo.localId)}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, or WebP. The image is privately cropped to 512 by
                  512 pixels before upload.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  id="visibility"
                  name="visibility"
                  defaultValue="PRIVATE"
                >
                  <option value="PRIVATE">Private - members only</option>
                  <option value="PUBLIC">
                    Public - authenticated discovery
                  </option>
                </Select>
              </div>
              {(processingError || logo?.error || error) && (
                <FormError>{processingError ?? logo?.error ?? error}</FormError>
              )}
              <Button
                type="submit"
                size="lg"
                className="mt-2 h-11 rounded-xl"
                disabled={createOrganization.isPending || logoIsNotReady}
              >
                {createOrganization.isPending
                  ? "Creating..."
                  : "Create workspace"}{" "}
                {!createOrganization.isPending && <ArrowRight />}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
