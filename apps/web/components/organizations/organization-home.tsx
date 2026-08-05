"use client";

import {
  ArrowRight,
  Globe2,
  Hash,
  Lock,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/workspace/page-header";
import { ResourceState } from "@/components/workspace/resource-state";
import { initials } from "@/components/workspace/app-shell";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { organizationsApi } from "@/lib/api/organizations";
import {
  useCategories,
  useChannels,
  useDirectMessages,
  useMembers,
  useOrganization,
} from "@/lib/query/hooks";
import { invalidateOrganizationNavigation } from "@/lib/query/invalidate";

export function OrganizationHome({
  organizationId,
}: {
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const organization = useOrganization(organizationId);
  const isMember = Boolean(organization.data?.currentUserRole);
  const categories = useCategories(organizationId, isMember);
  const channels = useChannels(organizationId, isMember);
  const directMessages = useDirectMessages(organizationId, isMember);
  const members = useMembers(organizationId, isMember);
  const join = useMutation({
    mutationFn: () => organizationsApi.join(organizationId),
    onSuccess: () =>
      invalidateOrganizationNavigation(queryClient, organizationId),
  });

  if (organization.isPending) {
    return (
      <ResourceState
        title="Loading workspace"
        description="Establishing access and loading organization details."
      />
    );
  }
  if (organization.isError || !organization.data) {
    return (
      <ResourceState
        title="Workspace not found"
        description="This organization is unavailable or you do not have access to it."
      />
    );
  }

  if (!organization.data.currentUserRole) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
        <section className="max-w-lg rounded-[2rem] border border-primary/25 bg-primary/10 p-9 text-center">
          <Globe2 className="mx-auto size-8 text-primary" />
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            Public organization
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {organization.data.name}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Join this organization to access its public channels, members, and
            conversations.
          </p>
          {join.isError && (
            <p className="mt-4 text-sm text-destructive">
              {join.error.message}
            </p>
          )}
          <Button
            className="mt-6 rounded-full"
            disabled={join.isPending}
            onClick={() => join.mutate()}
          >
            {join.isPending ? "Joining..." : "Join organization"} <ArrowRight />
          </Button>
        </section>
      </div>
    );
  }

  const channelList =
    channels.data?.filter((item) => item.type === "CHANNEL") ?? [];
  const dmList =
    directMessages.data?.pages.flatMap((page) => page.directMessages) ?? [];
  const unread = [...channelList, ...dmList].reduce(
    (total, conversation) => total + (conversation.unreadCount ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow={`${organization.data.visibility.toLowerCase()} organization`}
        title={organization.data.name}
        description={`${channelList.length} channels, ${members.data?.length ?? 0} members, and ${unread} unread messages.`}
        actions={
          organization.data.currentUserRole === "OWNER" ? (
            <LinkButton
              variant="outline"
              href={`/app/${organizationId}/settings`}
            >
              <Settings /> Settings
            </LinkButton>
          ) : undefined
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto grid max-w-6xl gap-6 p-5 md:p-8 lg:grid-cols-[1.45fr_0.7fr] lg:p-10">
          <section className="space-y-6">
            {(categories.data ?? []).map((category) => (
              <div
                key={category.id}
                className="rounded-[1.75rem] border border-border bg-background/30 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">{category.name}</h2>
                  <Badge variant="outline">
                    Position {category.position + 1}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {channelList
                    .filter((channel) => channel.categoryId === category.id)
                    .map((channel) => (
                      <Link
                        key={channel.id}
                        href={`/app/${organizationId}/channels/${channel.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card/35 p-4 hover:border-primary/30"
                      >
                        {channel.visibility === "PRIVATE" ? <Lock /> : <Hash />}
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {channel.name}
                        </span>
                        {!!channel.unreadCount && (
                          <Badge>{channel.unreadCount}</Badge>
                        )}
                      </Link>
                    ))}
                </div>
              </div>
            ))}
            {!categories.isPending && categories.data?.length === 0 && (
              <div className="rounded-[1.75rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                This organization does not have categories or channels yet.
              </div>
            )}

            <section className="rounded-[1.75rem] border border-border bg-background/30 p-5">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="size-4 text-primary" />
                <h2 className="font-semibold">Direct messages</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {dmList.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/app/${organizationId}/direct-messages/${conversation.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:bg-card/50"
                  >
                    <Avatar>
                      <AvatarFallback>
                        {initials(conversation.peer.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {conversation.peer.displayName}
                    </span>
                    {!!conversation.unreadCount && (
                      <Badge>{conversation.unreadCount}</Badge>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          </section>

          <aside className="h-fit rounded-[1.75rem] border border-border bg-background/30 p-5">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <h2 className="font-semibold">Members</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {members.data?.slice(0, 8).map((member) => (
                <div
                  key={member.membershipId}
                  className="flex items-center gap-3"
                >
                  <Avatar size="sm">
                    <AvatarFallback>
                      {initials(member.user.displayName)}
                    </AvatarFallback>
                    <AvatarBadge
                      className={
                        member.user.status === "ONLINE"
                          ? "bg-status"
                          : "bg-muted-foreground"
                      }
                    />
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {member.user.displayName}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {member.role}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </ScrollArea>
    </>
  );
}
