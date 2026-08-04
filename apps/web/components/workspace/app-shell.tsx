"use client";

import {
  Bell,
  ChevronDown,
  ChevronRight,
  Hash,
  Inbox,
  Lock,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDemoWorkspace } from "@/lib/demo/provider";
import {
  getDirectPeer,
  getOrganizationCategories,
  getOrganizationChannels,
  getOrganizationDirectMessages,
  getOrganizationMembers,
} from "@/lib/demo/selectors";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ComingSoonButton({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label} - coming later</TooltipContent>
    </Tooltip>
  );
}

function NewDirectMessageDialog({
  organizationId,
  onNavigate,
}: {
  organizationId: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { state, createDirectMessage } = useDemoWorkspace();
  const [open, setOpen] = useState(false);
  const members = getOrganizationMembers(state, organizationId).filter(
    (item) => item.user.id !== state.currentUser.id,
  );

  const selectMember = (userId: string) => {
    const result = createDirectMessage(organizationId, userId);
    if (result.success && result.id) {
      setOpen(false);
      onNavigate?.();
      router.push(`/app/${organizationId}/direct-messages/${result.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Start a direct message"
        onClick={() => setOpen(true)}
      >
        <Plus />
      </Button>
      <DialogContent>
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            New conversation
          </p>
          <DialogTitle>Choose a teammate</DialogTitle>
          <DialogDescription>
            Direct messages stay scoped to this organization.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 grid gap-2">
          {members.map((member) => (
            <button
              key={member.user.id}
              type="button"
              onClick={() => selectMember(member.user.id)}
              className="flex items-center gap-3 rounded-2xl border border-transparent p-3 text-left hover:border-border hover:bg-muted/50"
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
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {member.user.displayName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{member.user.username}
                </span>
              </span>
              <MessageCircle className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceNavigation({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const params = useParams<{ organizationId?: string }>();
  const { state } = useDemoWorkspace();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const organizations = state.organizations.filter(
    (item) => item.currentUserRole !== null,
  );
  const invitationCount = state.invitations.filter(
    (item) => item.invitedUserId === state.currentUser.id,
  ).length;
  const activeOrganization = organizations.find(
    (item) => item.id === params.organizationId,
  );
  const categories = activeOrganization
    ? getOrganizationCategories(state, activeOrganization.id)
    : [];
  const channels = activeOrganization
    ? getOrganizationChannels(state, activeOrganization.id)
    : [];
  const directMessages = activeOrganization
    ? getOrganizationDirectMessages(state, activeOrganization.id)
    : [];

  return (
    <aside
      className={cn(
        "flex h-full w-[286px] shrink-0 flex-col border-sidebar-border bg-sidebar/92 p-3 text-sidebar-foreground shadow-2xl backdrop-blur-xl",
        mobile ? "w-full border-0" : "hidden rounded-[1.7rem] border md:flex",
      )}
    >
      <Link
        href="/app"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/65 p-3"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-primary font-mono text-sm font-black text-primary-foreground">
          IN
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">InTouch</span>
          <span className="block truncate text-xs text-muted-foreground">
            {activeOrganization?.name ?? "Workspace hub"}
          </span>
        </span>
        <Sparkles className="size-4 text-primary" />
      </Link>

      <div className="mt-3 flex items-center gap-1 overflow-x-auto px-1 pb-1">
        {organizations.map((organization) => (
          <Tooltip key={organization.id}>
            <TooltipTrigger
              render={
                <Link
                  href={`/app/${organization.id}`}
                  onClick={onNavigate}
                  aria-label={organization.name}
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl border border-transparent bg-background/40 text-xs font-bold text-muted-foreground transition hover:text-foreground",
                    activeOrganization?.id === organization.id &&
                      "border-primary/40 bg-primary/10 text-primary",
                  )}
                />
              }
            >
              {initials(organization.name)}
            </TooltipTrigger>
            <TooltipContent>{organization.name}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/app/new-organization"
                onClick={onNavigate}
                aria-label="Create organization"
                className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              />
            }
          >
            <Plus className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Create workspace</TooltipContent>
        </Tooltip>
      </div>

      <nav className="mt-3 grid grid-cols-2 gap-1" aria-label="Application">
        <Link
          href="/app"
          onClick={onNavigate}
          className={cn(
            "flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            pathname === "/app" && "bg-sidebar-accent text-foreground",
          )}
        >
          <Sparkles className="size-3.5" /> Hub
        </Link>
        <Link
          href="/app/invitations"
          onClick={onNavigate}
          className={cn(
            "flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            pathname === "/app/invitations" &&
              "bg-sidebar-accent text-foreground",
          )}
        >
          <Inbox className="size-3.5" /> Invites
          {invitationCount > 0 && (
            <Badge className="ml-auto h-4 min-w-4 px-1 text-[9px]">
              {invitationCount}
            </Badge>
          )}
        </Link>
      </nav>

      <button
        type="button"
        disabled
        className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-sidebar-border bg-background/30 px-3 text-sm text-muted-foreground opacity-70"
        title="Search is coming later"
      >
        <Search className="size-4" /> Find anything
        <kbd className="ml-auto font-mono text-[10px]">Ctrl K</kbd>
      </button>

      <ScrollArea className="mt-5 min-h-0 flex-1">
        {activeOrganization ? (
          <div className="flex flex-col gap-6 px-1">
            {categories.map((category) => {
              const closed = collapsed.includes(category.id);
              const categoryChannels = channels.filter(
                (channel) => channel.categoryId === category.id,
              );
              return (
                <section key={category.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((value) =>
                        closed
                          ? value.filter((item) => item !== category.id)
                          : [...value, category.id],
                      )
                    }
                    className="mb-2 flex w-full items-center gap-1 text-xs font-semibold text-muted-foreground"
                  >
                    {closed ? <ChevronRight /> : <ChevronDown />}
                    {category.name}
                  </button>
                  {!closed && (
                    <div className="grid gap-1">
                      {categoryChannels.map((channel) => {
                        const href = `/app/${activeOrganization.id}/channels/${channel.id}`;
                        return (
                          <Link
                            key={channel.id}
                            href={href}
                            onClick={onNavigate}
                            className={cn(
                              "flex h-9 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                              pathname === href &&
                                "bg-primary/10 font-medium text-foreground ring-1 ring-primary/20",
                            )}
                          >
                            {channel.visibility === "PRIVATE" ? (
                              <Lock className="size-3.5" />
                            ) : (
                              <Hash className="size-3.5" />
                            )}
                            <span className="truncate">{channel.name}</span>
                            {channel.unreadCount > 0 && (
                              <Badge className="ml-auto h-5 min-w-5 px-1 text-[10px]">
                                {channel.unreadCount}
                              </Badge>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">
                  People
                </p>
                <NewDirectMessageDialog
                  organizationId={activeOrganization.id}
                  onNavigate={onNavigate}
                />
              </div>
              <div className="grid gap-1">
                {directMessages.map((conversation) => {
                  const peer = getDirectPeer(state, conversation);
                  if (!peer) return null;
                  const href = `/app/${activeOrganization.id}/direct-messages/${conversation.id}`;
                  return (
                    <Link
                      key={conversation.id}
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                        pathname === href &&
                          "bg-sidebar-accent text-foreground",
                      )}
                    >
                      <Avatar size="sm">
                        <AvatarFallback>
                          {initials(peer.displayName)}
                        </AvatarFallback>
                        <AvatarBadge
                          className={
                            peer.status === "ONLINE"
                              ? "bg-status"
                              : "bg-muted-foreground"
                          }
                        />
                      </Avatar>
                      <span className="truncate">{peer.displayName}</span>
                      {conversation.unreadCount > 0 && (
                        <Badge className="ml-auto h-5 min-w-5 px-1 text-[10px]">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-sidebar-border p-4 text-sm leading-6 text-muted-foreground">
            Choose a workspace to reveal its channels and people.
          </div>
        )}
      </ScrollArea>

      {activeOrganization && (
        <Link
          href={`/app/${activeOrganization.id}/settings`}
          onClick={onNavigate}
          className="mt-2 flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <Settings className="size-3.5" /> Workspace settings
        </Link>
      )}
      <div className="mt-2 flex items-center gap-2 rounded-2xl border border-sidebar-border bg-background/30 p-2">
        <Avatar>
          <AvatarFallback>
            {initials(state.currentUser.displayName)}
          </AvatarFallback>
          <AvatarBadge className="bg-status" />
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {state.currentUser.displayName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Frontend preview
          </p>
        </div>
        <ComingSoonButton label="Notifications" icon={<Bell />} />
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <main className="flex h-dvh min-w-0 overflow-hidden bg-background text-foreground md:gap-3 md:p-3">
      <WorkspaceNavigation />
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden border-border bg-card/75 shadow-2xl shadow-background/40 backdrop-blur-xl md:rounded-[1.7rem] md:border">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 px-4 md:hidden">
          <Sheet
            open={mobileNavigationOpen}
            onOpenChange={setMobileNavigationOpen}
          >
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open workspace navigation"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] gap-0 p-0">
              <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
              <WorkspaceNavigation
                mobile
                onNavigate={() => setMobileNavigationOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary font-mono text-xs font-black text-primary-foreground">
              IN
            </span>
            InTouch
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeSwitcher />
            <ComingSoonButton label="Search" icon={<Search />} />
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

export { initials };
