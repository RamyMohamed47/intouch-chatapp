"use client";

import { ArrowRight, Check, Clock3, Inbox, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/workspace/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDemoWorkspace } from "@/lib/demo/provider";
import { formatShortDate } from "@/lib/demo/format";
import { initials } from "@/components/workspace/app-shell";

export function InvitationsPage() {
  const { state, acceptInvitation, declineInvitation } = useDemoWorkspace();
  const [notice, setNotice] = useState<string | null>(null);
  const invitations = state.invitations.filter(
    (item) => item.invitedUserId === state.currentUser.id,
  );

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
          {invitations.length === 0 ? (
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
                  const organization = state.organizations.find(
                    (item) => item.id === invitation.organizationId,
                  );
                  const inviter = state.memberships
                    .map((item) => item.user)
                    .find((user) => user.id === invitation.invitedByUserId);
                  if (!organization) return null;
                  return (
                    <article
                      key={invitation.id}
                      className="relative overflow-hidden rounded-[1.75rem] border border-border bg-background/35 p-6"
                    >
                      <div className="absolute -top-16 -right-16 size-48 rounded-full bg-primary/10 blur-3xl" />
                      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
                        <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border bg-card text-sm font-bold">
                          {initials(organization.name)}
                        </span>
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
                            {inviter?.displayName ?? "An organization owner"}{" "}
                            invited you to collaborate as a member.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Clock3 className="size-3.5" /> Expires{" "}
                              {formatShortDate(invitation.expiresAt)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="size-3.5" /> Member access
                            </span>
                          </div>
                          <div className="mt-6 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className="rounded-full"
                              onClick={() => {
                                const result = acceptInvitation(invitation.id);
                                setNotice(
                                  result.success
                                    ? `${organization.name} was added to your workspaces.`
                                    : (result.error ?? null),
                                );
                              }}
                            >
                              <Check /> Accept invitation
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="rounded-full"
                              onClick={() => {
                                declineInvitation(invitation.id);
                                setNotice(
                                  `Invitation to ${organization.name} declined.`,
                                );
                              }}
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
