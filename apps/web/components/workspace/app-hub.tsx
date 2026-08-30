"use client";

import {
  ArrowRight,
  Building2,
  Hash,
  Inbox,
  MessageCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import type { MessageCoreDto } from "@intouch/shared/messages";

import { BrandLockup } from "@/components/brand/brand";
import { PageHeader } from "@/components/workspace/page-header";
import { OrganizationAvatar } from "@/components/organizations/organization-avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { conversationsApi } from "@/lib/api/conversations";
import { useAuth } from "@/lib/auth/provider";
import { useInvitations, useOrganizations } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const messagePreview = (message: MessageCoreDto) => {
  if (message.deletedAt) return "Message deleted";
  if (message.content) return message.content;
  if (
    message.attachments.length === 1 &&
    message.attachments[0]?.kind === "IMAGE"
  ) {
    return "Photo";
  }
  return message.attachments.length > 0 ? "Files" : "Message";
};

export function AppHub() {
  const { user } = useAuth();
  const organizations = useOrganizations();
  const invitations = useInvitations();
  const organizationList = organizations.data ?? [];
  const channelQueries = useQueries({
    queries: organizationList.map((organization) => ({
      queryKey: queryKeys.conversations.channels(organization.id),
      queryFn: () => conversationsApi.listChannels(organization.id),
    })),
  });
  const directMessageQueries = useQueries({
    queries: organizationList.map((organization) => ({
      queryKey: queryKeys.conversations.directMessagePreview(organization.id),
      queryFn: () =>
        conversationsApi.listDirectMessages(organization.id, { limit: 30 }),
    })),
  });

  const cards = organizationList.map((organization, index) => {
    const channels = channelQueries[index]?.data ?? [];
    const directMessages =
      directMessageQueries[index]?.data?.directMessages ?? [];
    const conversations = [...channels, ...directMessages];
    return {
      organization,
      channels,
      directMessages,
      unread: conversations.reduce(
        (total, conversation) => total + (conversation.unreadCount ?? 0),
        0,
      ),
    };
  });
  const recent = cards
    .flatMap(({ organization, channels, directMessages }) =>
      [...channels, ...directMessages]
        .filter((conversation) => conversation.lastMessage)
        .map((conversation) => ({ organization, conversation })),
    )
    .sort((left, right) =>
      right.conversation.lastMessage!.createdAt.localeCompare(
        left.conversation.lastMessage!.createdAt,
      ),
    )
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Workspace hub"
        title={`Welcome back, ${user?.displayName.split(" ")[0] ?? "there"}.`}
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
            <BrandLockup
              className="relative mx-auto h-36 w-full max-w-sm"
              preload
            />
          </section>

          {organizations.isPending ? (
            <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
              Loading your organizations...
            </p>
          ) : organizations.isError ? (
            <button
              type="button"
              onClick={() => void organizations.refetch()}
              className="w-full rounded-2xl border border-destructive/30 p-6 text-left text-sm text-destructive"
            >
              Organizations could not be loaded. Select to retry.
            </button>
          ) : (
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
                  {cards.length} active
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map(
                  ({ organization, channels, directMessages, unread }) => (
                    <Link
                      key={organization.id}
                      href={`/app/${organization.id}`}
                      className="group relative overflow-hidden rounded-[1.75rem] border border-border bg-background/35 p-5 shadow-lg transition hover:-translate-y-0.5 hover:border-primary/35"
                    >
                      <div className="relative flex items-start gap-3">
                        <OrganizationAvatar
                          name={organization.name}
                          logoAssetId={organization.logoAssetId}
                          className="size-12"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <strong className="truncate">
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
                        <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1" />
                      </div>
                      <div className="relative mt-8 grid grid-cols-3 gap-2">
                        <Metric value={channels.length} label="Channels" />
                        <Metric value={directMessages.length} label="DMs" />
                        <Metric value={unread} label="Unread" accent />
                      </div>
                    </Link>
                  ),
                )}
                {cards.length === 0 && (
                  <Link
                    href="/app/new-organization"
                    className="grid min-h-48 place-items-center rounded-[1.75rem] border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
                  >
                    Create your first organization
                  </Link>
                )}
              </div>
            </section>
          )}

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
                {recent.map(({ organization, conversation }) => {
                  const message = conversation.lastMessage!;
                  const isChannel = conversation.type === "CHANNEL";
                  const href = isChannel
                    ? `/app/${organization.id}/channels/${conversation.id}`
                    : `/app/${organization.id}/direct-messages/${conversation.id}`;
                  return (
                    <Link
                      key={conversation.id}
                      href={href}
                      className="flex items-center gap-3 rounded-2xl p-3 hover:bg-card/60"
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                        {isChannel ? <Hash /> : <MessageCircle />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {isChannel
                            ? conversation.name
                            : conversation.peer.displayName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {messagePreview(message)}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatTime(message.createdAt)}
                      </span>
                    </Link>
                  );
                })}
                {recent.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Recent conversations will appear after the first message.
                  </p>
                )}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-primary/10 p-6">
              <Inbox className="size-5 text-primary" />
              <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                {invitations.data?.length
                  ? `${invitations.data.length} invitation${invitations.data.length === 1 ? "" : "s"} waiting.`
                  : "Your invitation inbox is clear."}
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

          <section className="flex items-center gap-3 rounded-2xl border border-border bg-card/35 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Building2 />
            </span>
            <span>
              <span className="block text-lg font-semibold">
                {cards.length}
              </span>
              <span className="block text-xs text-muted-foreground">
                Organizations in reach
              </span>
            </span>
          </section>
        </div>
      </ScrollArea>
    </>
  );
}

function Metric({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={
          accent
            ? "text-lg font-semibold text-primary"
            : "text-lg font-semibold"
        }
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
