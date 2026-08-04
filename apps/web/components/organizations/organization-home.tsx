"use client";

import {
  ArrowRight,
  Hash,
  Lock,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/workspace/page-header";
import { ResourceState } from "@/components/workspace/resource-state";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDemoWorkspace } from "@/lib/demo/provider";
import {
  getLastMessage,
  getOrganization,
  getOrganizationCategories,
  getOrganizationChannels,
  getOrganizationDirectMessages,
  getOrganizationMembers,
} from "@/lib/demo/selectors";
import { formatTime } from "@/lib/demo/format";
import { initials } from "@/components/workspace/app-shell";

export function OrganizationHome({
  organizationId,
}: {
  organizationId: string;
}) {
  const { state } = useDemoWorkspace();
  const organization = getOrganization(state, organizationId);
  if (!organization || organization.currentUserRole === null) {
    return (
      <ResourceState
        title="Workspace not found"
        description="This organization is unavailable or has not been added to your account."
      />
    );
  }
  const categories = getOrganizationCategories(state, organizationId);
  const channels = getOrganizationChannels(state, organizationId);
  const dms = getOrganizationDirectMessages(state, organizationId);
  const members = getOrganizationMembers(state, organizationId);
  const online = members.filter((item) => item.user.status === "ONLINE");
  const unread = [...channels, ...dms].reduce(
    (total, item) => total + item.unreadCount,
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow={`${organization.visibility} organization`}
        title={organization.name}
        description="A clear view of rooms, people, and conversations in motion."
        actions={
          organization.currentUserRole === "OWNER" ? (
            <LinkButton
              variant="outline"
              className="rounded-full"
              href={`/app/${organization.id}/settings`}
            >
              <Settings /> <span className="hidden sm:inline">Settings</span>
            </LinkButton>
          ) : (
            <Badge variant="outline" className="rounded-full">
              Member
            </Badge>
          )
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8 lg:p-10">
          <section className="relative overflow-hidden rounded-[2rem] border border-border bg-background/35 p-6 md:p-8">
            <div className="absolute -top-20 right-0 size-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <Badge className="rounded-full" variant="outline">
                  {organization.currentUserRole}
                </Badge>
                <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                  Context lives where the conversation happens.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                  Enter a channel, continue a direct thread, or see who is
                  available right now.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  [channels.length, "Channels"],
                  [online.length, "Online"],
                  [unread, "Unread"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="min-w-20 rounded-2xl border border-border bg-card/55 p-4 text-center"
                  >
                    <p className="text-xl font-semibold">{value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-[1.75rem] border border-border bg-background/30 p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    Channel map
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Find the right room
                  </h2>
                </div>
                <Hash className="size-5 text-muted-foreground" />
              </div>
              <div className="mt-6 grid gap-6">
                {categories.map((category) => (
                  <div key={category.id}>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      {category.name}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {channels
                        .filter((channel) => channel.categoryId === category.id)
                        .map((channel) => {
                          const message = getLastMessage(state, channel);
                          return (
                            <Link
                              key={channel.id}
                              href={`/app/${organization.id}/channels/${channel.id}`}
                              className="group rounded-2xl border border-border bg-card/35 p-4 hover:border-primary/35"
                            >
                              <div className="flex items-center gap-2">
                                {channel.visibility === "PRIVATE" ? (
                                  <Lock className="size-4 text-primary" />
                                ) : (
                                  <Hash className="size-4 text-primary" />
                                )}
                                <span className="truncate text-sm font-medium">
                                  {channel.name}
                                </span>
                                {channel.unreadCount > 0 && (
                                  <Badge className="ml-auto h-5 min-w-5 px-1">
                                    {channel.unreadCount}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-3 truncate text-xs text-muted-foreground">
                                {message?.deletedAt
                                  ? "Message deleted"
                                  : (message?.content ?? "No messages yet")}
                              </p>
                              <span className="mt-4 flex items-center gap-1 text-[10px] text-muted-foreground group-hover:text-primary">
                                Open room <ArrowRight className="size-3" />
                              </span>
                            </Link>
                          );
                        })}
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No categories yet. Owners can add the first one in settings.
                  </div>
                )}
              </div>
            </section>

            <aside className="rounded-[1.75rem] border border-border bg-background/30 p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    Presence
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Available now</h2>
                </div>
                <Users className="size-5 text-muted-foreground" />
              </div>
              <div className="mt-5 grid gap-3">
                {members.slice(0, 6).map((membership) => (
                  <div
                    key={membership.membershipId}
                    className="flex items-center gap-3"
                  >
                    <Avatar>
                      <AvatarFallback>
                        {initials(membership.user.displayName)}
                      </AvatarFallback>
                      <AvatarBadge
                        className={
                          membership.user.status === "ONLINE"
                            ? "bg-status"
                            : "bg-muted-foreground"
                        }
                      />
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {membership.user.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {membership.role.toLowerCase()} -{" "}
                        {membership.user.status.toLowerCase()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-border pt-5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Direct messages
                </p>
                <div className="mt-3 grid gap-2">
                  {dms.slice(0, 3).map((dm) => {
                    const peerId = dm.participantIds.find(
                      (id) => id !== state.currentUser.id,
                    );
                    const peer = members.find(
                      (item) => item.user.id === peerId,
                    )?.user;
                    if (!peer) return null;
                    const last = getLastMessage(state, dm);
                    return (
                      <Link
                        key={dm.id}
                        href={`/app/${organization.id}/direct-messages/${dm.id}`}
                        className="flex items-center gap-2 rounded-xl p-2 hover:bg-muted/50"
                      >
                        <MessageCircle className="size-4 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {peer.displayName}
                        </span>
                        {last && (
                          <span className="font-mono text-[9px] text-muted-foreground">
                            {formatTime(last.createdAt)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
