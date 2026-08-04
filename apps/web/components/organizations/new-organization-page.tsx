"use client";

import { ArrowLeft, ArrowRight, Building2, Globe2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/workspace/page-header";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { useDemoWorkspace } from "@/lib/demo/provider";
import { getFormString } from "@/lib/utils";

export function NewOrganizationPage() {
  const router = useRouter();
  const { createOrganization } = useDemoWorkspace();
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const logoUrl = getFormString(form, "logoUrl").trim();
    const result = createOrganization({
      name: getFormString(form, "name"),
      ...(logoUrl ? { logoUrl } : {}),
      visibility: getFormString(form, "visibility") as "PRIVATE" | "PUBLIC",
    });
    if (!result.success || !result.id) {
      setError(result.error ?? "Workspace could not be created");
      return;
    }
    router.push(`/app/${result.id}`);
  };

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
              <div className="grid gap-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  name="logoUrl"
                  type="url"
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. HTTP and HTTPS URLs are supported.
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
              {error && <FormError>{error}</FormError>}
              <Button type="submit" size="lg" className="mt-2 h-11 rounded-xl">
                Create workspace <ArrowRight />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
