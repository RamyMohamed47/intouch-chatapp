"use client";

import { ArrowRight, Check, Clock3, Inbox, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/workspace/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { membershipsApi } from "@/lib/api/memberships";
import { useInvitations } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { OrganizationAvatar } from "@/components/organizations/organization-avatar";

export function InvitationsPage() {
  const queryClient = useQueryClient();
  const invitationsQuery = useInvitations();
  const [notice, setNotice] = useState<string | null>(null);
  const invitations = invitationsQuery.data ?? [];
  const acceptInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      membershipsApi.acceptInvitation(invitationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.organizations.all,
        }),
      ]);
    },
  });
  const declineInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      membershipsApi.declineInvitation(invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Invitation inbox"
        title="Workspaces waiting for you"
        description="Accept an invitation to add the organization to your workspace rail."
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-5xl p-5 md:p-8 lg:p-10">
          {notice && (
            <div
              role="status"
              className="mb-5 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary"
            >
              {notice}
            </div>
          )}
          {invitationsQuery.isPending ? (
            <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
              Loading invitations...
            </p>
          ) : invitationsQuery.isError ? (
            <button
              type="button"
              onClick={() => void invitationsQuery.refetch()}
              className="w-full rounded-2xl border border-destructive/30 p-6 text-left text-sm text-destructive"
            >
              Invitations could not be loaded. Select to retry.
            </button>
          ) : invitations.length === 0 ? (
            <section className="grid min-h-[55vh] place-items-center rounded-[2rem] border border-dashed border-border bg-background/20 p-8 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Inbox />
                </span>
                <h2 className="mt-5 text-2xl font-semibold">
                  Your invitation inbox is clear.
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  New invitations for your registered account will appear here
                  until accepted, declined, or expired.
                </p>
                <LinkButton className="mt-6 rounded-full" href="/app">
                  Return to hub <ArrowRight />
                </LinkButton>
              </div>
            </section>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.48fr]">
              <section className="grid gap-4">
                {invitations.map((invitation) => {
                  const organization = invitation.organization;
                  return (
                    <article
                      key={invitation.id}
                      className="relative overflow-hidden rounded-[1.75rem] border border-border bg-background/35 p-6"
                    >
                      <div className="absolute -top-16 -right-16 size-48 rounded-full bg-primary/10 blur-3xl" />
                      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
                        <OrganizationAvatar
                          name={organization.name}
                          logoAssetId={organization.logoAssetId}
                          className="size-14"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold">
                              {organization.name}
                            </h2>
                            <Badge variant="outline" className="rounded-full">
                              {organization.visibility}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            An organization owner invited you to collaborate as
                            a member.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Clock3 className="size-3.5" /> Expires{" "}
                              {new Intl.DateTimeFormat(undefined, {
                                dateStyle: "medium",
                              }).format(new Date(invitation.expiresAt))}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="size-3.5" /> Member access
                            </span>
                          </div>
                          <div className="mt-6 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className="rounded-full"
                              disabled={
                                acceptInvitation.isPending ||
                                declineInvitation.isPending
                              }
                              onClick={() =>
                                acceptInvitation.mutate(invitation.id, {
                                  onSuccess: () =>
                                    setNotice(
                                      `${organization.name} was added to your workspaces.`,
                                    ),
                                  onError: (error) => setNotice(error.message),
                                })
                              }
                            >
                              <Check /> Accept invitation
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="rounded-full"
                              disabled={
                                acceptInvitation.isPending ||
                                declineInvitation.isPending
                              }
                              onClick={() =>
                                declineInvitation.mutate(invitation.id, {
                                  onSuccess: () =>
                                    setNotice(
                                      `Invitation to ${organization.name} declined.`,
                                    ),
                                  onError: (error) => setNotice(error.message),
                                })
                              }
                            >
                              <X /> Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
              <aside className="h-fit rounded-[1.75rem] border border-primary/20 bg-primary/10 p-6">
                <ShieldCheck className="size-5 text-primary" />
                <h2 className="mt-5 text-lg font-semibold">
                  Invitation safety
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Invitations are tied to your registered account and expire
                  after seven days. Accepting always grants member access, never
                  ownership.
                </p>
              </aside>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
