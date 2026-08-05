"use client";

import {
  ArrowRight,
  Building2,
  Hash,
  Inbox,
  MessageCircle,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand";
import { PageHeader } from "@/components/workspace/page-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDemoWorkspace } from "@/lib/demo/provider";
import {
  getDirectPeer,
  getLastMessage,
  getOrganizationChannels,
  getOrganizationDirectMessages,
  getOrganizationMembers,
} from "@/lib/demo/selectors";
import { formatTime } from "@/lib/demo/format";
import { initials } from "@/components/workspace/app-shell";

export function AppHub() {
  const { state } = useDemoWorkspace();
  const organizations = state.organizations.filter(
    (item) => item.currentUserRole !== null,
  );
  const invitations = state.invitations.filter(
    (item) => item.invitedUserId === state.currentUser.id,
  );
  const recentConversations = state.conversations
    .filter((conversation) =>
      organizations.some(
        (organization) => organization.id === conversation.organizationId,
      ),
    )
    .map((conversation) => ({
      conversation,
      message: getLastMessage(state, conversation),
      organization: organizations.find(
        (item) => item.id === conversation.organizationId,
      ),
    }))
    .filter((item) => item.message)
    .sort((a, b) => b.message!.createdAt.localeCompare(a.message!.createdAt))
    .slice(0, 4);

  return (
    <>
      <PageHeader
        eyebrow="Workspace hub"
        title={`Good afternoon, ${state.currentUser.displayName.split(" ")[0]}.`}
        description="Choose where to focus or pick up a recent conversation."
        actions={
          <LinkButton className="rounded-full" href="/app/new-organization">
            <Plus /> <span className="hidden sm:inline">New workspace</span>
          </LinkButton>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl space-y-10 p-5 md:p-8 lg:p-10">
          <section className="relative overflow-hidden rounded-[1.75rem] border border-brand-blue/20 bg-background/30 px-6 py-5 sm:px-8">
            <div className="absolute -top-16 -left-12 size-44 rounded-full bg-brand-blue/12 blur-3xl" />
            <div className="absolute -right-10 -bottom-20 size-48 rounded-full bg-brand-orange/10 blur-3xl" />
            <BrandLockup className="relative mx-auto h-36 w-full max-w-sm" />
          </section>
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                  Your organizations
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  Pick a place to move work forward.
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {organizations.length} active
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {organizations.map((organization, index) => {
                const channels = getOrganizationChannels(
                  state,
                  organization.id,
                );
                const dms = getOrganizationDirectMessages(
                  state,
                  organization.id,
                );
                const members = getOrganizationMembers(state, organization.id);
                const unread = [...channels, ...dms].reduce(
                  (total, item) => total + item.unreadCount,
                  0,
                );
                return (
                  <Link
                    key={organization.id}
                    href={`/app/${organization.id}`}
                    className="group relative overflow-hidden rounded-[1.75rem] border border-border bg-background/35 p-5 shadow-lg transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background/50"
                  >
                    <div
                      className={`absolute -top-20 -right-20 size-52 rounded-full blur-3xl ${
                        index % 2 === 0 ? "bg-primary/10" : "bg-status/10"
                      }`}
                    />
                    <div className="relative flex items-start gap-3">
                      <span className="grid size-12 place-items-center rounded-2xl border border-border bg-card text-sm font-bold">
                        {initials(organization.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <strong className="truncate text-base">
                            {organization.name}
                          </strong>
                          <Badge
                            variant="outline"
                            className="rounded-full text-[9px]"
                          >
                            {organization.currentUserRole}
                          </Badge>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {organization.visibility.toLowerCase()} workspace
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <div className="relative mt-8 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-lg font-semibold">
                          {channels.length}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Channels
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">
                          {members.length}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          People
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-primary">
                          {unread}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Unread
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
            <section className="rounded-[1.75rem] border border-border bg-background/30 p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    Recent threads
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Continue the conversation
                  </h2>
                </div>
                <MessageCircle className="size-5 text-muted-foreground" />
              </div>
              <div className="mt-5 grid gap-2">
                {recentConversations.map(
                  ({ conversation, message, organization }) => {
                    if (!message || !organization) return null;
                    const peer = getDirectPeer(state, conversation);
                    const label =
                      conversation.type === "CHANNEL"
                        ? conversation.name
                        : peer?.displayName;
                    const href =
                      conversation.type === "CHANNEL"
                        ? `/app/${organization.id}/channels/${conversation.id}`
                        : `/app/${organization.id}/direct-messages/${conversation.id}`;
                    return (
                      <Link
                        key={conversation.id}
                        href={href}
                        className="flex items-center gap-3 rounded-2xl border border-transparent p-3 hover:border-border hover:bg-card/60"
                      >
                        <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                          {conversation.type === "CHANNEL" ? (
                            <Hash />
                          ) : (
                            <MessageCircle />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span className="truncate">{label}</span>
                            <span className="truncate text-xs font-normal text-muted-foreground">
                              {organization.name}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {message.deletedAt
                              ? "Message deleted"
                              : message.content}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatTime(message.createdAt)}
                        </span>
                      </Link>
                    );
                  },
                )}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-primary/10 p-6">
              <div className="absolute -right-10 -bottom-12 size-40 rounded-full border-[2.5rem] border-primary/10" />
              <Inbox className="size-5 text-primary" />
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                Invitations
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {invitations.length === 0
                  ? "Your inbox is clear."
                  : `${invitations.length} workspace is waiting.`}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Review invitations before they expire and join when the context
                is right.
              </p>
              <LinkButton
                variant="outline"
                className="relative mt-7 rounded-full bg-background/40"
                href="/app/invitations"
              >
                Review invitations <ArrowRight />
              </LinkButton>
            </section>
          </div>

          <section className="grid gap-3 sm:grid-cols-3">
            {[
              [Building2, "Organizations", organizations.length],
              [
                Users,
                "People in reach",
                new Set(state.memberships.map((item) => item.user.id)).size,
              ],
              [
                MessageCircle,
                "Direct threads",
                state.conversations.filter((item) => item.type === "DIRECT")
                  .length,
              ],
            ].map(([Icon, label, value]) => {
              const CardIcon = Icon as typeof Building2;
              return (
                <div
                  key={label as string}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/35 p-4"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <CardIcon />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold">
                      {value as number}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {label as string}
                    </span>
                  </span>
                </div>
              );
            })}
          </section>
        </div>
      </ScrollArea>
    </>
  );
}
