"use client";

import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Hash,
  Lock,
  MailPlus,
  Plus,
  Save,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCategorySchema,
  updateCategorySchema,
  type CategoryDto,
} from "@intouch/shared/categories";
import {
  createConversationSchema,
  updateConversationSchema,
  type ChannelConversationDto,
} from "@intouch/shared/conversations";
import { inviteMemberSchema } from "@intouch/shared/memberships";
import { updateOrganizationSchema } from "@intouch/shared/organizations";

import { PageHeader } from "@/components/workspace/page-header";
import { ResourceState } from "@/components/workspace/resource-state";
import { initials } from "@/components/workspace/app-shell";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoriesApi } from "@/lib/api/categories";
import { conversationsApi } from "@/lib/api/conversations";
import { membershipsApi } from "@/lib/api/memberships";
import { organizationsApi } from "@/lib/api/organizations";
import {
  useCategories,
  useChannels,
  useMembers,
  useOrganization,
  useParticipants,
} from "@/lib/query/hooks";
import { invalidateOrganizationNavigation } from "@/lib/query/invalidate";
import { queryKeys } from "@/lib/query/keys";
import { getFormString } from "@/lib/utils";

const firstIssue = (error: { issues: { message: string }[] }) =>
  error.issues[0]?.message ?? "The submitted values are invalid";

function Notice({ message }: { message: string | null }) {
  return message ? (
    <div className="mt-4">
      <FormError>{message}</FormError>
    </div>
  ) : null;
}

function GeneralSettings({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organization = useOrganization(organizationId);
  const [notice, setNotice] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: (input: Parameters<typeof organizationsApi.update>[1]) =>
      organizationsApi.update(organizationId, input),
    onSuccess: async () => {
      await invalidateOrganizationNavigation(queryClient, organizationId);
      setNotice(null);
    },
    onError: (error) => setNotice(error.message),
  });
  const remove = useMutation({
    mutationFn: () => organizationsApi.remove(organizationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.all,
      });
      router.replace("/app");
    },
    onError: (error) => setNotice(error.message),
  });
  if (!organization.data) return null;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const logoUrl = getFormString(data, "logoUrl").trim();
    const parsed = updateOrganizationSchema.safeParse({
      name: getFormString(data, "name"),
      logoUrl: logoUrl || null,
      visibility: getFormString(data, "visibility"),
    });
    if (!parsed.success) {
      setNotice(firstIssue(parsed.error));
      return;
    }
    update.mutate(parsed.data);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.65fr]">
      <form
        onSubmit={submit}
        className="rounded-[1.75rem] border border-border bg-background/30 p-6"
      >
        <h2 className="text-lg font-semibold">Organization identity</h2>
        <div className="mt-6 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="organization-name">Name</Label>
            <Input
              id="organization-name"
              name="name"
              defaultValue={organization.data.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="organization-logo">Logo URL</Label>
            <Input
              id="organization-logo"
              name="logoUrl"
              type="url"
              defaultValue={organization.data.logoUrl ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="organization-visibility">Visibility</Label>
            <Select
              id="organization-visibility"
              name="visibility"
              defaultValue={organization.data.visibility}
            >
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </Select>
          </div>
          <Notice message={notice} />
          <Button
            type="submit"
            disabled={update.isPending}
            className="w-fit rounded-full"
          >
            <Save /> {update.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
      <aside className="h-fit rounded-[1.75rem] border border-destructive/25 bg-destructive/5 p-6">
        <Trash2 className="size-5 text-destructive" />
        <h2 className="mt-5 text-lg font-semibold">Delete organization</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This permanently deletes categories, conversations, memberships,
          invitations, messages, and receipts.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-6 rounded-full"
          disabled={remove.isPending}
          onClick={() => {
            if (
              window.confirm(
                `Delete ${organization.data?.name}? This cannot be undone.`,
              )
            )
              remove.mutate();
          }}
        >
          Delete workspace
        </Button>
      </aside>
    </div>
  );
}

function CategoryRow({
  organizationId,
  category,
  index,
  total,
}: {
  organizationId: string;
  category: CategoryDto;
  index: number;
  total: number;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.categories.list(organizationId),
    });
  const update = useMutation({
    mutationFn: (input: Parameters<typeof categoriesApi.update>[2]) =>
      categoriesApi.update(organizationId, category.id, input),
    onSuccess: refresh,
    onError: (error) => setNotice(error.message),
  });
  const remove = useMutation({
    mutationFn: () => categoriesApi.remove(organizationId, category.id),
    onSuccess: refresh,
    onError: (error) => setNotice(error.message),
  });
  return (
    <form
      className="rounded-2xl border border-border bg-card/35 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = updateCategorySchema.safeParse({
          name: getFormString(new FormData(event.currentTarget), "name"),
        });
        if (parsed.success) {
          update.mutate(parsed.data);
        } else {
          setNotice(firstIssue(parsed.error));
        }
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid size-8 place-items-center rounded-lg bg-muted font-mono text-xs">
          {index + 1}
        </span>
        <Input
          name="name"
          defaultValue={category.name}
          aria-label={`Rename ${category.name}`}
        />
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === 0 || update.isPending}
            onClick={() => update.mutate({ position: index - 1 })}
            aria-label={`Move ${category.name} up`}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === total - 1 || update.isPending}
            onClick={() => update.mutate({ position: index + 1 })}
            aria-label={`Move ${category.name} down`}
          >
            <ArrowDown />
          </Button>
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            disabled={update.isPending}
            aria-label={`Save ${category.name}`}
          >
            <Save />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
            aria-label={`Delete ${category.name}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <Notice message={notice} />
    </form>
  );
}

function CategorySettings({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const categories = useCategories(organizationId);
  const [notice, setNotice] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (name: string) =>
      categoriesApi.create(organizationId, { name }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.categories.list(organizationId),
      }),
    onError: (error) => setNotice(error.message),
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[0.65fr_1.35fr]">
      <form
        className="h-fit rounded-[1.75rem] border border-border bg-background/30 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const parsed = createCategorySchema.safeParse({
            name: getFormString(new FormData(form), "name"),
          });
          if (!parsed.success) return setNotice(firstIssue(parsed.error));
          create.mutate(parsed.data.name, { onSuccess: () => form.reset() });
        }}
      >
        <h2 className="text-lg font-semibold">Create category</h2>
        <div className="mt-5 grid gap-2">
          <Label htmlFor="new-category">Name</Label>
          <Input id="new-category" name="name" placeholder="Operations" />
        </div>
        <Notice message={notice} />
        <Button
          type="submit"
          className="mt-5 rounded-full"
          disabled={create.isPending}
        >
          <Plus /> Add category
        </Button>
      </form>
      <section className="rounded-[1.75rem] border border-border bg-background/30 p-6">
        <h2 className="text-lg font-semibold">Category order</h2>
        <div className="mt-5 grid gap-3">
          {categories.data?.map((category, index) => (
            <CategoryRow
              key={category.id}
              organizationId={organizationId}
              category={category}
              index={index}
              total={categories.data?.length ?? 0}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PrivateParticipants({
  organizationId,
  channel,
}: {
  organizationId: string;
  channel: ChannelConversationDto;
}) {
  const queryClient = useQueryClient();
  const members = useMembers(organizationId);
  const participants = useParticipants(channel.id);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.participants(channel.id),
    });
  const add = useMutation({
    mutationFn: (userId: string) =>
      conversationsApi.addParticipant(channel.id, { userId }),
    onSuccess: refresh,
    onError: (error) => setNotice(error.message),
  });
  const remove = useMutation({
    mutationFn: (userId: string) =>
      conversationsApi.removeParticipant(channel.id, userId),
    onSuccess: refresh,
    onError: (error) => setNotice(error.message),
  });
  const participantIds = new Set(
    participants.data?.map((participant) => participant.userId),
  );
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        Private participants
      </p>
      <div className="flex flex-wrap gap-2">
        {members.data?.map((member) => {
          const active = participantIds.has(member.user.id);
          const owner = member.role === "OWNER";
          return (
            <button
              key={member.user.id}
              type="button"
              disabled={owner || add.isPending || remove.isPending}
              aria-pressed={active}
              onClick={() =>
                active
                  ? remove.mutate(member.user.id)
                  : add.mutate(member.user.id)
              }
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"} disabled:opacity-60`}
            >
              {active ? (
                <UserMinus className="size-3" />
              ) : (
                <UserPlus className="size-3" />
              )}
              {member.user.displayName}
              {owner ? " (owner)" : ""}
            </button>
          );
        })}
      </div>
      <Notice message={notice} />
    </div>
  );
}

function ChannelCard({
  organizationId,
  channel,
  categories,
}: {
  organizationId: string;
  channel: ChannelConversationDto;
  categories: CategoryDto[];
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () =>
    invalidateOrganizationNavigation(queryClient, organizationId);
  const update = useMutation({
    mutationFn: (input: Parameters<typeof conversationsApi.update>[1]) =>
      conversationsApi.update(channel.id, input),
    onSuccess: refresh,
    onError: (error) => setNotice(error.message),
  });
  const remove = useMutation({
    mutationFn: () => conversationsApi.remove(channel.id),
    onSuccess: refresh,
    onError: (error) => setNotice(error.message),
  });
  return (
    <form
      className="rounded-[1.75rem] border border-border bg-background/30 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const parsed = updateConversationSchema.safeParse({
          name: getFormString(data, "name"),
          categoryId: getFormString(data, "categoryId"),
          visibility: getFormString(data, "visibility"),
        });
        if (parsed.success) {
          update.mutate(parsed.data);
        } else {
          setNotice(firstIssue(parsed.error));
        }
      }}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-muted">
          {channel.visibility === "PRIVATE" ? <Lock /> : <Hash />}
        </span>
        <strong className="min-w-0 flex-1 truncate">{channel.name}</strong>
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
          aria-label={`Delete ${channel.name}`}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label>Name</Label>
          <Input name="name" defaultValue={channel.name} />
        </div>
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select name="categoryId" defaultValue={channel.categoryId}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Visibility</Label>
          <Select name="visibility" defaultValue={channel.visibility}>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </Select>
        </div>
      </div>
      {channel.visibility === "PRIVATE" && (
        <PrivateParticipants
          organizationId={organizationId}
          channel={channel}
        />
      )}
      <Notice message={notice} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="mt-5 rounded-full"
        disabled={update.isPending}
      >
        <Save /> Save channel
      </Button>
    </form>
  );
}

function ChannelSettings({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const categories = useCategories(organizationId);
  const channels = useChannels(organizationId);
  const [notice, setNotice] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (input: Parameters<typeof conversationsApi.createChannel>[1]) =>
      conversationsApi.createChannel(organizationId, input),
    onSuccess: () =>
      invalidateOrganizationNavigation(queryClient, organizationId),
    onError: (error) => setNotice(error.message),
  });
  const channelList =
    channels.data?.filter(
      (item): item is ChannelConversationDto => item.type === "CHANNEL",
    ) ?? [];
  return (
    <div className="grid gap-5">
      <form
        className="rounded-[1.75rem] border border-border bg-background/30 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const parsed = createConversationSchema.safeParse({
            name: getFormString(data, "name"),
            categoryId: getFormString(data, "categoryId"),
            visibility: getFormString(data, "visibility"),
          });
          if (!parsed.success) return setNotice(firstIssue(parsed.error));
          create.mutate(parsed.data, { onSuccess: () => form.reset() });
        }}
      >
        <h2 className="font-semibold">Create channel</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_0.8fr_auto] md:items-end">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input name="name" placeholder="team-updates" />
          </div>
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select name="categoryId" disabled={!categories.data?.length}>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Visibility</Label>
            <Select name="visibility" defaultValue="PUBLIC">
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={!categories.data?.length || create.isPending}
          >
            <Plus /> Create
          </Button>
        </div>
        <Notice message={notice} />
      </form>
      <section className="grid gap-4 lg:grid-cols-2">
        {channelList.map((channel) => (
          <ChannelCard
            key={channel.id}
            organizationId={organizationId}
            channel={channel}
            categories={categories.data ?? []}
          />
        ))}
      </section>
    </div>
  );
}

function MemberSettings({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const members = useMembers(organizationId);
  const [notice, setNotice] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: (email: string) =>
      membershipsApi.invite(organizationId, { email }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all }),
    onError: (error) => setNotice(error.message),
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
      <form
        className="h-fit rounded-[1.75rem] border border-primary/20 bg-primary/10 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const parsed = inviteMemberSchema.safeParse({
            email: getFormString(new FormData(form), "email"),
          });
          if (!parsed.success) return setNotice(firstIssue(parsed.error));
          invite.mutate(parsed.data.email, {
            onSuccess: () => {
              form.reset();
              setNotice("Invitation created.");
            },
          });
        }}
      >
        <MailPlus className="size-5 text-primary" />
        <h2 className="mt-5 text-lg font-semibold">Invite a registered user</h2>
        <div className="mt-5 grid gap-2">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="person@company.com"
          />
        </div>
        <Notice message={notice} />
        <Button
          type="submit"
          className="mt-5 rounded-full"
          disabled={invite.isPending}
        >
          <MailPlus /> Send invitation
        </Button>
      </form>
      <section className="rounded-[1.75rem] border border-border bg-background/30 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Organization members</h2>
          <Badge variant="outline">{members.data?.length ?? 0}</Badge>
        </div>
        <div className="mt-5 grid gap-3">
          {members.data?.map((member) => (
            <div
              key={member.membershipId}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card/35 p-3"
            >
              <Avatar>
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
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.user.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{member.user.username} - {member.user.status.toLowerCase()}
                </p>
              </div>
              <Badge variant="outline">{member.role}</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OrganizationSettings({
  organizationId,
}: {
  organizationId: string;
}) {
  const organization = useOrganization(organizationId);
  if (organization.isPending)
    return (
      <ResourceState
        title="Loading settings"
        description="Verifying owner access."
      />
    );
  if (organization.isError || !organization.data)
    return (
      <ResourceState
        title="Workspace not found"
        description="This organization is unavailable or inaccessible."
      />
    );
  if (organization.data.currentUserRole !== "OWNER") {
    return (
      <ResourceState
        kind="forbidden"
        title="Owner access required"
        description="Only the organization owner can change workspace settings."
        href={`/app/${organizationId}`}
      />
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Owner workspace"
        title={`${organization.data.name} settings`}
        description="Shape organization identity, rooms, access, and membership."
        actions={
          <LinkButton variant="ghost" href={`/app/${organizationId}`}>
            <ArrowLeft /> Workspace
          </LinkButton>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl p-5 md:p-8 lg:p-10">
          <Tabs defaultValue="general">
            <TabsList className="mb-6 w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="channels">Channels</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <GeneralSettings organizationId={organizationId} />
            </TabsContent>
            <TabsContent value="categories">
              <CategorySettings organizationId={organizationId} />
            </TabsContent>
            <TabsContent value="channels">
              <ChannelSettings organizationId={organizationId} />
            </TabsContent>
            <TabsContent value="members">
              <MemberSettings organizationId={organizationId} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </>
  );
}
