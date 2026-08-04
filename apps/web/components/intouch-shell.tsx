"use client";

import { useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Hash,
  Menu,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  channelGroups,
  directMessages,
  members,
  messages,
  organizations,
} from "@/lib/intouch-data";
import { cn } from "@/lib/utils";

function IconButton({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon" className={className} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function WorkspacePicker() {
  const [active, setActive] = useState("northstar");
  return (
    <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-2">
      <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sidebar-accent">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-mono text-sm font-bold text-primary-foreground">
          IN
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">InTouch</span>
          <span className="block truncate text-xs text-muted-foreground">
            Northstar studio
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
      <div className="mt-2 flex items-center gap-1 px-1">
        {organizations.map((org) => (
          <Tooltip key={org.id}>
            <TooltipTrigger
              render={
                <button
                  onClick={() => setActive(org.id)}
                  aria-label={org.label}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg border border-transparent bg-background/40 text-xs font-semibold text-muted-foreground hover:text-foreground",
                    active === org.id &&
                      "border-primary/35 bg-primary/10 text-primary",
                  )}
                />
              }
            >
              {org.initials}
            </TooltipTrigger>
            <TooltipContent>{org.label}</TooltipContent>
          </Tooltip>
        ))}
        <button
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Add workspace"
        >
          <Plus />
        </button>
      </div>
    </div>
  );
}

function ChannelSidebar({ mobile = false }: { mobile?: boolean }) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  return (
    <aside
      className={cn(
        "flex h-full w-[270px] shrink-0 flex-col rounded-[1.6rem] border border-sidebar-border bg-sidebar/90 p-3 text-sidebar-foreground shadow-2xl shadow-background/20 backdrop-blur-xl",
        !mobile && "hidden md:flex",
        mobile && "w-full rounded-none border-0 shadow-none",
      )}
    >
      <WorkspacePicker />
      <button className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-sidebar-border bg-background/35 px-3 text-sm text-muted-foreground hover:text-foreground">
        <Search className="size-4" />
        <span>Find anything</span>
        <kbd className="ml-auto font-mono text-[10px]">⌘ K</kbd>
      </button>
      <ScrollArea className="mt-5 min-h-0 flex-1">
        <nav
          className="flex flex-col gap-6 px-1"
          aria-label="Workspace channels"
        >
          {channelGroups.map((group) => {
            const closed = collapsed.includes(group.label);
            return (
              <section key={group.label}>
                <button
                  onClick={() =>
                    setCollapsed((value) =>
                      closed
                        ? value.filter((item) => item !== group.label)
                        : [...value, group.label],
                    )
                  }
                  className="mb-2 flex w-full items-center gap-1 text-xs font-semibold text-muted-foreground"
                >
                  {closed ? <ChevronRight /> : <ChevronDown />} {group.label}
                </button>
                {!closed && (
                  <div className="flex flex-col gap-1">
                    {group.channels.map((channel) => (
                      <button
                        key={channel.name}
                        className={cn(
                          "flex h-9 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                          channel.active &&
                            "bg-primary/10 font-medium text-foreground ring-1 ring-primary/20",
                        )}
                      >
                        <Hash
                          className={cn(
                            "size-4",
                            channel.active && "text-primary",
                          )}
                        />
                        <span className="truncate">{channel.name}</span>
                        {channel.unread && (
                          <Badge className="ml-auto h-5 min-w-5 px-1">
                            {channel.unread}
                          </Badge>
                        )}
                      </button>
                    ))}
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
              <Plus className="size-3.5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              {directMessages.map((person) => (
                <button
                  key={person.name}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{person.initials}</AvatarFallback>
                    <AvatarBadge
                      className={
                        person.status === "online" ? "bg-status" : "bg-primary"
                      }
                    />
                  </Avatar>
                  <span>{person.name}</span>
                </button>
              ))}
            </div>
          </section>
        </nav>
      </ScrollArea>
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-sidebar-border bg-background/35 p-2">
        <Avatar>
          <AvatarFallback>AR</AvatarFallback>
          <AvatarBadge className="bg-status" />
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">Alex Rivera</p>
          <p className="truncate text-[11px] text-muted-foreground">
            In focus mode
          </p>
        </div>
        <IconButton label="Mute">
          <Mic />
        </IconButton>
        <IconButton label="Settings">
          <Settings />
        </IconButton>
      </div>
    </aside>
  );
}

function ActivityPanel({ mobile = false }: { mobile?: boolean }) {
  const active = members.filter((member) => member.status !== "offline");
  return (
    <aside
      className={cn(
        "h-full w-[280px] shrink-0 border-l border-border/70 bg-card/45",
        !mobile && "hidden xl:block",
        mobile && "w-full border-0",
      )}
    >
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-7 p-5">
          <section>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Activity pulse
                </p>
                <h2 className="mt-1 text-lg font-semibold">Team in motion</h2>
              </div>
              <span className="size-2 rounded-full bg-status shadow-[0_0_14px_var(--status)]" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Four collaborators are active across product and engineering.
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-background/35 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-4 text-primary" />
              Next sync · 1:30 PM
            </div>
            <p className="mt-3 text-sm font-semibold">Onboarding handoff</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Review final copy and move the flow into the release candidate.
            </p>
            <div className="mt-4 flex -space-x-2">
              {active.slice(0, 3).map((member) => (
                <Avatar
                  key={member.name}
                  size="sm"
                  className="ring-2 ring-card"
                >
                  <AvatarFallback>{member.initials}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Present now
            </p>
            <div className="flex flex-col gap-3">
              {active.map((member, index) => (
                <div key={member.name} className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{member.initials}</AvatarFallback>
                    <AvatarBadge
                      className={
                        member.status === "online" ? "bg-status" : "bg-primary"
                      }
                    />
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {index === 0
                        ? "Reviewing roadmap"
                        : index === 1
                          ? "Editing prototype"
                          : index === 2
                            ? "Building handoff"
                            : "Reading research"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/20">
            <WandSparkles className="size-5 text-primary" />
            <p className="mt-3 text-sm font-semibold">Quiet momentum</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              12 decisions captured this week with fewer meetings.
            </p>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}

function ChatHeader() {
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border/70 px-4 md:px-6">
      <Sheet>
        <SheetTrigger
          render={
            <Button
              className="md:hidden"
              variant="ghost"
              size="icon"
              aria-label="Open channels"
            />
          }
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-[290px] gap-0 p-0">
          <SheetTitle className="sr-only">Workspace channels</SheetTitle>
          <ChannelSidebar mobile />
        </SheetContent>
      </Sheet>
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Hash />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-base font-semibold">product-design</h1>
          <Badge
            variant="outline"
            className="hidden rounded-full sm:inline-flex"
          >
            Live
          </Badge>
        </div>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          Critiques, explorations and decisions shaping InTouch.
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button className="hidden h-9 w-44 items-center gap-2 rounded-full border border-border bg-background/35 px-3 text-sm text-muted-foreground hover:text-foreground lg:flex">
          <Search className="size-4" />
          Search
        </button>
        <ThemeSwitcher />
        <IconButton label="Notifications">
          <Bell />
        </IconButton>
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open activity pulse"
              />
            }
          >
            <Users />
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] gap-0 p-0">
            <SheetTitle className="sr-only">Activity pulse</SheetTitle>
            <ActivityPanel mobile />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function Conversation() {
  const [draft, setDraft] = useState("");
  const submit = () => setDraft("");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pb-8 pt-10 md:px-10">
          <div className="mb-10 max-w-2xl">
            <Badge
              variant="outline"
              className="rounded-full border-primary/25 bg-primary/10 text-primary"
            >
              Design room
            </Badge>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Build in the open,
              <br className="hidden sm:block" /> decide with context.
            </h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              A shared room for early work, thoughtful critique, and the
              decisions that move Northstar forward.
            </p>
          </div>
          <div className="mb-7 flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Today · August 4
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-8">
            {messages.map((message) => (
              <article
                key={message.id}
                className="group grid grid-cols-[40px_1fr] gap-3 md:grid-cols-[48px_1fr] md:gap-4"
              >
                <Avatar size="lg">
                  <AvatarFallback>{message.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <h3 className="text-sm font-semibold">{message.author}</h3>
                    <span className="text-xs text-muted-foreground">
                      {message.role}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {message.time}
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] leading-7 text-foreground/90">
                    {message.text}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/65 px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
                      <Sparkles className="size-3 text-primary" />
                      {message.reaction}
                      <span className="font-mono text-[10px]">
                        {message.count}
                      </span>
                    </button>
                    <button
                      aria-label="Add reaction"
                      className="rounded-full p-1.5 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
                    >
                      <Smile className="size-4" />
                    </button>
                    <IconButton
                      label="More actions"
                      className="ml-auto opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal />
                    </IconButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </ScrollArea>
      <div className="shrink-0 px-3 pb-3 md:px-6 md:pb-5">
        <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card/90 p-2 shadow-2xl shadow-background/50 backdrop-blur-xl focus-within:border-primary/50">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Share an update with the room..."
            aria-label="Message product-design"
            className="min-h-12 resize-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <IconButton label="Add attachment">
                <Paperclip />
              </IconButton>
              <IconButton label="Choose emoji">
                <Smile />
              </IconButton>
              <IconButton label="Smart actions">
                <Sparkles />
              </IconButton>
            </div>
            <Button
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
  );
}

export function InTouchShell() {
  return (
    <main className="flex h-dvh min-w-0 overflow-hidden bg-background p-0 text-foreground md:gap-3 md:p-3">
      <ChannelSidebar />
      <section className="flex min-w-0 flex-1 overflow-hidden border-border bg-card/75 shadow-2xl shadow-background/40 backdrop-blur-xl md:rounded-[1.6rem] md:border">
        <div className="flex min-w-0 flex-1 flex-col">
          <ChatHeader />
          <Conversation />
        </div>
        <ActivityPanel />
      </section>
    </main>
  );
}
