"use client";

import {
  CheckCheck,
  Hash,
  Lock,
  MoreHorizontal,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/workspace/page-header";
import { ResourceState } from "@/components/workspace/resource-state";
import { initials } from "@/components/workspace/app-shell";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useDemoWorkspace } from "@/lib/demo/provider";
import {
  getConversation,
  getConversationMessages,
  getDirectPeer,
  getOrganization,
  getOrganizationMembers,
  getUser,
} from "@/lib/demo/selectors";
import { formatRelativePresence, formatTime } from "@/lib/demo/format";
import type {
  DemoChannelConversation,
  DemoConversation,
  DemoMembership,
} from "@/lib/demo/types";

function MembersPanel({
  members,
  conversation,
  mobile = false,
}: {
  members: DemoMembership[];
  conversation: DemoConversation;
  mobile?: boolean;
}) {
  const visibleMembers =
    conversation.type === "CHANNEL" && conversation.visibility === "PRIVATE"
      ? members.filter((item) =>
          conversation.participantIds.includes(item.user.id),
        )
      : conversation.type === "DIRECT"
        ? members.filter((item) =>
            conversation.participantIds.includes(item.user.id),
          )
        : members;
  const online = visibleMembers.filter((item) => item.user.status === "ONLINE");

  return (
    <aside
      className={`h-full w-[280px] shrink-0 border-l border-border/70 bg-card/35 ${
        mobile ? "w-full border-0" : "hidden xl:block"
      }`}
    >
      <ScrollArea className="h-full">
        <div className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            In this conversation
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {online.length} present now
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Presence is fixture-driven until realtime integration begins.
          </p>
          <div className="mt-6 grid gap-4">
            {visibleMembers.map((membership) => (
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
                    {membership.user.status === "ONLINE"
                      ? "Available now"
                      : formatRelativePresence(membership.user.lastSeenAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <Sparkles className="size-4 text-primary" />
            <p className="mt-3 text-sm font-semibold">Quiet presence</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Typing and presence updates will become live when Socket.IO is
              connected.
            </p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function ParticipantDialog({
  conversation,
  members,
}: {
  conversation: DemoChannelConversation;
  members: DemoMembership[];
}) {
  const { state, addParticipant, removeParticipant } = useDemoWorkspace();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => setOpen(true)}
      >
        <UserPlus /> <span className="hidden sm:inline">Participants</span>
      </Button>
      <DialogContent>
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            Private access
          </p>
          <DialogTitle>Manage channel participants</DialogTitle>
          <DialogDescription>
            Organization membership is still required. This list adds
            private-channel access.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 grid max-h-[50vh] gap-2 overflow-auto">
          {members.map((membership) => {
            const included = conversation.participantIds.includes(
              membership.user.id,
            );
            const isOwner = membership.user.id === state.currentUser.id;
            return (
              <div
                key={membership.user.id}
                className="flex items-center gap-3 rounded-2xl border border-border p-3"
              >
                <Avatar size="sm">
                  <AvatarFallback>
                    {initials(membership.user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {membership.user.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{membership.user.username}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={included ? "ghost" : "outline"}
                  disabled={isOwner}
                  onClick={() => {
                    const result = included
                      ? removeParticipant(conversation.id, membership.user.id)
                      : addParticipant(conversation.id, membership.user.id);
                    setError(result.success ? null : (result.error ?? null));
                  }}
                >
                  {included ? (isOwner ? "Owner" : "Remove") : "Add"}
                </Button>
              </div>
            );
          })}
        </div>
        {error && <FormError className="mt-3">{error}</FormError>}
      </DialogContent>
    </Dialog>
  );
}

function MessageItem({
  messageId,
  conversation,
}: {
  messageId: string;
  conversation: DemoConversation;
}) {
  const { state, editMessage, deleteMessage } = useDemoWorkspace();
  const message = state.messages.find((item) => item.id === messageId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message?.content ?? "");
  if (!message) return null;
  const sender = getUser(state, message.senderId);
  const organization = getOrganization(state, conversation.organizationId);
  const canEdit =
    message.senderId === state.currentUser.id && !message.deletedAt;
  const canDelete =
    !message.deletedAt &&
    (message.senderId === state.currentUser.id ||
      (conversation.type === "CHANNEL" &&
        organization?.currentUserRole === "OWNER"));

  const saveEdit = (event: FormEvent) => {
    event.preventDefault();
    const result = editMessage(message.id, draft);
    if (result.success) setEditing(false);
  };

  return (
    <article className="group grid grid-cols-[40px_1fr] gap-3 md:grid-cols-[44px_1fr]">
      <Avatar size="lg">
        <AvatarFallback>
          {initials(sender?.displayName ?? "Unknown")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold">
            {sender?.displayName ?? "Unknown member"}
          </h3>
          <span className="text-xs text-muted-foreground">
            @{sender?.username ?? "unknown"}
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
          {(canEdit || canDelete) && (
            <DropdownMenu
              trigger={({ open, toggle }) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Message actions"
                  aria-expanded={open}
                  onClick={toggle}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <MoreHorizontal />
                </Button>
              )}
            >
              {canEdit && (
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  Edit message
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteMessage(message.id)}
                >
                  Delete message
                </DropdownMenuItem>
              )}
            </DropdownMenu>
          )}
        </div>
        {editing ? (
          <form onSubmit={saveEdit} className="mt-2 flex gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
              aria-label="Edit message"
            />
            <Button type="submit">Save</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </form>
        ) : message.deletedAt ? (
          <p className="mt-2 text-sm italic text-muted-foreground">
            Message deleted
          </p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
            {message.content}
            {message.editedAt && (
              <span className="ml-2 text-[10px] text-muted-foreground">
                (edited)
              </span>
            )}
          </p>
        )}
      </div>
    </article>
  );
}

export function ConversationPage({
  organizationId,
  conversationId,
  expectedType,
}: {
  organizationId: string;
  conversationId: string;
  expectedType: "CHANNEL" | "DIRECT";
}) {
  const { state, sendMessage } = useDemoWorkspace();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const conversation = getConversation(state, conversationId);
  const organization = getOrganization(state, organizationId);
  if (
    !organization ||
    organization.currentUserRole === null ||
    !conversation ||
    conversation.organizationId !== organizationId ||
    conversation.type !== expectedType
  ) {
    return (
      <ResourceState
        title="Conversation not found"
        description="This conversation is unavailable, private, or no longer belongs to this workspace."
        href={organization?.currentUserRole ? `/app/${organizationId}` : "/app"}
      />
    );
  }
  const messages = getConversationMessages(state, conversation.id);
  const members = getOrganizationMembers(state, organization.id);
  const peer = getDirectPeer(state, conversation);
  const label =
    conversation.type === "CHANNEL"
      ? conversation.name
      : (peer?.displayName ?? "Direct message");
  const isOwner = organization.currentUserRole === "OWNER";

  const submit = () => {
    const result = sendMessage(conversation.id, draft);
    if (!result.success) {
      setError(result.error ?? "Message could not be sent");
      return;
    }
    setDraft("");
    setError(null);
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow={
            conversation.type === "CHANNEL"
              ? `${conversation.visibility} channel`
              : "Direct message"
          }
          title={label}
          description={
            conversation.type === "CHANNEL"
              ? "Messages stay scoped to this channel and organization."
              : peer?.status === "ONLINE"
                ? `${peer.displayName} is online now.`
                : formatRelativePresence(peer?.lastSeenAt ?? null)
          }
          actions={
            <>
              {conversation.type === "CHANNEL" &&
                conversation.visibility === "PRIVATE" &&
                isOwner && (
                  <ParticipantDialog
                    conversation={conversation}
                    members={members}
                  />
                )}
              <Sheet>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="xl:hidden"
                      aria-label="Show members"
                    />
                  }
                >
                  <Users />
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] gap-0 p-0">
                  <SheetTitle className="sr-only">
                    Conversation members
                  </SheetTitle>
                  <MembersPanel
                    members={members}
                    conversation={conversation}
                    mobile
                  />
                </SheetContent>
              </Sheet>
            </>
          }
        />
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-4xl flex-col px-5 py-8 md:px-9 md:py-10">
            <section className="mb-9 max-w-2xl">
              <Badge
                variant="outline"
                className="rounded-full border-primary/25 bg-primary/10 text-primary"
              >
                {conversation.type === "CHANNEL" ? (
                  conversation.visibility === "PRIVATE" ? (
                    <>
                      <Lock /> Private room
                    </>
                  ) : (
                    <>
                      <Hash /> Open room
                    </>
                  )
                ) : (
                  <>
                    <CheckCheck /> One-to-one
                  </>
                )}
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                {conversation.type === "CHANNEL"
                  ? `Welcome to #${conversation.name}.`
                  : `A direct line to ${peer?.displayName ?? "your teammate"}.`}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {conversation.type === "CHANNEL"
                  ? "Use this room for focused updates, decisions, and context the whole audience can revisit."
                  : "This conversation is private to both organization members. Organization owners cannot moderate direct messages."}
              </p>
            </section>
            <div className="mb-7 flex items-center gap-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Today - August 4
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-8">
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  messageId={message.id}
                  conversation={conversation}
                />
              ))}
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No messages yet. Start the conversation below.
                </div>
              )}
            </div>
            {messages.length > 0 && conversation.type === "DIRECT" && (
              <p className="mt-6 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                <CheckCheck className="size-3 text-primary" /> Read receipt
                preview
              </p>
            )}
          </div>
        </ScrollArea>
        <div className="shrink-0 px-3 pb-3 md:px-6 md:pb-5">
          <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card/90 p-2 shadow-2xl backdrop-blur-xl focus-within:border-primary/50">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={`Message ${conversation.type === "CHANNEL" ? `#${conversation.name}` : (peer?.displayName ?? "teammate")}`}
              aria-label="Message content"
              className="min-h-12 resize-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0"
            />
            {error && <FormError className="px-3 pb-2">{error}</FormError>}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {[
                  [Paperclip, "Attachments"],
                  [Smile, "Emoji"],
                  [Sparkles, "Smart actions"],
                ].map(([Icon, text]) => {
                  const ActionIcon = Icon as typeof Paperclip;
                  return (
                    <Button
                      key={text as string}
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled
                      title={`${text as string} coming later`}
                      aria-label={`${text as string} coming later`}
                    >
                      <ActionIcon />
                    </Button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                {draft.trim() && (
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    You are typing...
                  </span>
                )}
                <Button
                  type="button"
                  className="rounded-full"
                  size="icon"
                  onClick={submit}
                  disabled={!draft.trim()}
                  aria-label="Send message"
                >
                  <Send />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <MembersPanel members={members} conversation={conversation} />
    </div>
  );
}
