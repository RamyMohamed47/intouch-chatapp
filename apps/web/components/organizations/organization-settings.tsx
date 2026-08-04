"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Hash,
  Lock,
  MailPlus,
  Plus,
  Save,
  Settings,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/workspace/page-header";
import { ResourceState } from "@/components/workspace/resource-state";
import { initials } from "@/components/workspace/app-shell";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { useDemoWorkspace } from "@/lib/demo/provider";
import {
  getOrganization,
  getOrganizationCategories,
  getOrganizationChannels,
  getOrganizationMembers,
} from "@/lib/demo/selectors";
import type {
  DemoActionResult,
  DemoChannelConversation,
} from "@/lib/demo/types";
import { getFormString } from "@/lib/utils";

function ResultMessage({ result }: { result: DemoActionResult | null }) {
  if (!result) return null;
  return result.success ? (
    <p role="status" className="text-xs text-primary">
      Changes saved in the demo workspace.
    </p>
  ) : (
    <FormError>{result.error}</FormError>
  );
}

function GeneralSettings({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const { state, updateOrganization, deleteOrganization } = useDemoWorkspace();
  const organization = getOrganization(state, organizationId)!;
  const [result, setResult] = useState<DemoActionResult | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const logoUrl = getFormString(form, "logoUrl").trim();
    setResult(
      updateOrganization(organizationId, {
        name: getFormString(form, "name"),
        logoUrl: logoUrl || null,
        visibility: getFormString(form, "visibility") as "PRIVATE" | "PUBLIC",
      }),
    );
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.72fr]">
      <form
        onSubmit={submit}
        className="rounded-[1.75rem] border border-border bg-background/30 p-6"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Settings />
          </span>
          <div>
            <h2 className="font-semibold">Organization profile</h2>
            <p className="text-xs text-muted-foreground">
              Name, logo, and visibility.
            </p>
          </div>
        </div>
        <div className="mt-7 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="organization-name">Name</Label>
            <Input
              id="organization-name"
              name="name"
              defaultValue={organization.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="organization-logo">Logo URL</Label>
            <Input
              id="organization-logo"
              name="logoUrl"
              type="url"
              defaultValue={organization.logoUrl ?? ""}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="organization-visibility">Visibility</Label>
            <Select
              id="organization-visibility"
              name="visibility"
              defaultValue={organization.visibility}
            >
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </Select>
          </div>
          <ResultMessage result={result} />
          <Button type="submit" className="w-fit rounded-full">
            <Save /> Save changes
          </Button>
        </div>
      </form>

      <aside className="h-fit rounded-[1.75rem] border border-destructive/25 bg-destructive/5 p-6">
        <Trash2 className="size-5 text-destructive" />
        <h2 className="mt-5 text-lg font-semibold">Delete workspace</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This preview removes the organization, memberships, channels,
          invitations, and messages from in-memory state.
        </p>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" className="mt-6 rounded-full" />
            }
          >
            Delete {organization.name}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this organization?</AlertDialogTitle>
              <AlertDialogDescription>
                The demo state will cascade-delete all related resources.
                Reloading the page restores the fixtures.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel render={<Button variant="ghost" />}>
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => {
                  const deletion = deleteOrganization(organizationId);
                  if (deletion.success) router.push("/app");
                }}
              >
                Delete workspace
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>
    </div>
  );
}

function CategorySettings({ organizationId }: { organizationId: string }) {
  const {
    state,
    createCategory,
    renameCategory,
    moveCategory,
    deleteCategory,
  } = useDemoWorkspace();
  const categories = getOrganizationCategories(state, organizationId);
  const [result, setResult] = useState<DemoActionResult | null>(null);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.65fr_1.35fr]">
      <form
        className="h-fit rounded-[1.75rem] border border-border bg-background/30 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const action = createCategory(
            organizationId,
            getFormString(new FormData(form), "name"),
          );
          setResult(action);
          if (action.success) form.reset();
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          New category
        </p>
        <h2 className="mt-2 text-lg font-semibold">Group related channels</h2>
        <div className="mt-5 grid gap-2">
          <Label htmlFor="new-category-name">Category name</Label>
          <Input id="new-category-name" name="name" placeholder="Operations" />
        </div>
        <ResultMessage result={result} />
        <Button type="submit" className="mt-5 rounded-full">
          <Plus /> Add category
        </Button>
      </form>

      <section className="rounded-[1.75rem] border border-border bg-background/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Order
            </p>
            <h2 className="mt-1 text-lg font-semibold">Workspace categories</h2>
          </div>
          <Badge variant="outline" className="rounded-full">
            {categories.length}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3">
          {categories.map((category, index) => (
            <form
              key={category.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card/35 p-4 sm:flex-row sm:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                setResult(
                  renameCategory(
                    category.id,
                    getFormString(new FormData(event.currentTarget), "name"),
                  ),
                );
              }}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted font-mono text-xs text-muted-foreground">
                {index + 1}
              </span>
              <Input
                name="name"
                defaultValue={category.name}
                aria-label={`Rename ${category.name}`}
                className="sm:flex-1"
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => moveCategory(category.id, -1)}
                  aria-label={`Move ${category.name} up`}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === categories.length - 1}
                  onClick={() => moveCategory(category.id, 1)}
                  aria-label={`Move ${category.name} down`}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Save ${category.name}`}
                >
                  <Save />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => setResult(deleteCategory(category.id))}
                  aria-label={`Delete ${category.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </form>
          ))}
          {categories.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Create the first category to unlock channel creation.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function PrivateParticipants({
  channel,
  organizationId,
}: {
  channel: DemoChannelConversation;
  organizationId: string;
}) {
  const { state, addParticipant, removeParticipant } = useDemoWorkspace();
  const members = getOrganizationMembers(state, organizationId);
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        Private participants
      </p>
      <div className="flex flex-wrap gap-2">
        {members.map((membership) => {
          const active = channel.participantIds.includes(membership.user.id);
          const owner = membership.user.id === state.currentUser.id;
          return (
            <button
              key={membership.user.id}
              type="button"
              disabled={owner}
              aria-pressed={active}
              onClick={() =>
                active
                  ? removeParticipant(channel.id, membership.user.id)
                  : addParticipant(channel.id, membership.user.id)
              }
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              } disabled:opacity-70`}
            >
              {active ? (
                <UserMinus className="size-3" />
              ) : (
                <UserPlus className="size-3" />
              )}
              {membership.user.displayName}
              {owner ? " (owner)" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChannelSettings({ organizationId }: { organizationId: string }) {
  const { state, createChannel, updateChannel, deleteChannel } =
    useDemoWorkspace();
  const categories = getOrganizationCategories(state, organizationId);
  const channels = getOrganizationChannels(state, organizationId);
  const [result, setResult] = useState<DemoActionResult | null>(null);

  return (
    <div className="grid gap-5">
      <form
        className="rounded-[1.75rem] border border-border bg-background/30 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const action = createChannel(organizationId, {
            name: getFormString(data, "name"),
            categoryId: getFormString(data, "categoryId"),
            visibility: getFormString(data, "visibility") as
              "PRIVATE" | "PUBLIC",
          });
          setResult(action);
          if (action.success) form.reset();
        }}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Hash />
          </span>
          <div>
            <h2 className="font-semibold">Create channel</h2>
            <p className="text-xs text-muted-foreground">
              Every channel belongs to one category.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_0.8fr_auto] md:items-end">
          <div className="grid gap-2">
            <Label htmlFor="new-channel-name">Name</Label>
            <Input
              id="new-channel-name"
              name="name"
              placeholder="team-updates"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-channel-category">Category</Label>
            <Select
              id="new-channel-category"
              name="categoryId"
              disabled={categories.length === 0}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-channel-visibility">Visibility</Label>
            <Select
              id="new-channel-visibility"
              name="visibility"
              defaultValue="PUBLIC"
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </Select>
          </div>
          <Button type="submit" disabled={categories.length === 0}>
            <Plus /> Create
          </Button>
        </div>
        <div className="mt-3">
          <ResultMessage result={result} />
        </div>
      </form>

      <section className="grid gap-4 lg:grid-cols-2">
        {channels.map((channel) => (
          <form
            key={channel.id}
            className="rounded-[1.75rem] border border-border bg-background/30 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setResult(
                updateChannel(channel.id, {
                  name: getFormString(data, "name"),
                  categoryId: getFormString(data, "categoryId"),
                  visibility: getFormString(data, "visibility") as
                    "PRIVATE" | "PUBLIC",
                }),
              );
            }}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                {channel.visibility === "PRIVATE" ? <Lock /> : <Hash />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{channel.name}</p>
                <p className="text-xs text-muted-foreground">
                  Position {channel.position + 1}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                aria-label={`Delete ${channel.name}`}
                onClick={() => setResult(deleteChannel(channel.id))}
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
                channel={channel}
                organizationId={organizationId}
              />
            )}
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="mt-5 rounded-full"
            >
              <Save /> Save channel
            </Button>
          </form>
        ))}
      </section>
    </div>
  );
}

function MemberSettings({ organizationId }: { organizationId: string }) {
  const { state, inviteMember } = useDemoWorkspace();
  const members = getOrganizationMembers(state, organizationId);
  const pending = state.invitations.filter(
    (item) =>
      item.organizationId === organizationId &&
      item.invitedByUserId === state.currentUser.id,
  );
  const [result, setResult] = useState<DemoActionResult | null>(null);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
      <form
        className="h-fit rounded-[1.75rem] border border-primary/20 bg-primary/10 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const action = inviteMember(
            organizationId,
            getFormString(new FormData(form), "email"),
          );
          setResult(action);
          if (action.success) form.reset();
        }}
      >
        <MailPlus className="size-5 text-primary" />
        <h2 className="mt-5 text-lg font-semibold">Invite a registered user</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Try{" "}
          <span className="font-mono text-foreground">priya@intouch.demo</span>{" "}
          in this fixture set.
        </p>
        <div className="mt-5 grid gap-2">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="person@company.com"
          />
        </div>
        <div className="mt-3">
          <ResultMessage result={result} />
        </div>
        <Button type="submit" className="mt-5 rounded-full">
          <MailPlus /> Send invitation
        </Button>
        {pending.length > 0 && (
          <p className="mt-5 text-xs text-muted-foreground">
            {pending.length} outgoing invitation pending.
          </p>
        )}
      </form>

      <section className="rounded-[1.75rem] border border-border bg-background/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Directory
            </p>
            <h2 className="mt-1 text-lg font-semibold">Organization members</h2>
          </div>
          <Badge variant="outline" className="rounded-full">
            {members.length}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3">
          {members.map((membership) => (
            <div
              key={membership.membershipId}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card/35 p-3"
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
                  @{membership.user.username} -{" "}
                  {membership.user.status.toLowerCase()}
                </p>
              </div>
              <Badge variant="outline" className="rounded-full">
                {membership.role}
              </Badge>
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
  if (organization.currentUserRole !== "OWNER") {
    return (
      <ResourceState
        kind="forbidden"
        title="Owner access required"
        description="Members can collaborate in channels and direct messages, but only the organization owner can change workspace settings."
        href={`/app/${organizationId}`}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Owner workspace"
        title={`${organization.name} settings`}
        description="Shape organization identity, rooms, access, and membership."
        actions={
          <LinkButton variant="ghost" href={`/app/${organizationId}`}>
            <ArrowLeft /> <span className="hidden sm:inline">Workspace</span>
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
