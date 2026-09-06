"use client";

import {
  AiScopeKind,
  AiSummaryMode,
  AiTask,
  type AiWorkspaceSource,
} from "@intouch/shared/ai";
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  Send,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { aiApi } from "@/lib/api/ai";
import { useAiGeneration } from "@/lib/ai/use-ai-generation";
import { useAiSettings, useConversation } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AiWorkspaceSource[];
}

const safeComponents = {
  a: ({ href, children }: React.ComponentProps<"a">) => {
    const safeHref =
      href?.startsWith("http://") || href?.startsWith("https://")
        ? href
        : undefined;
    return safeHref ? (
      <a
        href={safeHref}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
};

function SourceList({
  organizationId,
  sources,
  onNavigate,
}: {
  organizationId: string;
  sources: AiWorkspaceSource[];
  onNavigate: () => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2 border-t border-border/70 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Workspace sources supplied to Gemini
      </p>
      {sources.slice(0, 6).map((source) => {
        const base =
          source.conversationType === "DIRECT" ? "direct-messages" : "channels";
        return (
          <Link
            key={source.sourceId}
            href={`/app/${organizationId}/${base}/${source.conversationId}?messageId=${source.messageId}`}
            onClick={onNavigate}
            className="rounded-xl border border-border bg-background/40 p-2.5 text-xs transition hover:border-primary/35"
          >
            <span className="flex items-center gap-2 font-medium">
              [{source.sourceId}] {source.conversationLabel}
              <ExternalLink className="ml-auto size-3" aria-hidden />
            </span>
            <span className="mt-1 block line-clamp-2 text-muted-foreground">
              {source.sender.displayName}: {source.excerpt}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function AiAssistantPanel({
  organizationId,
  conversationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const settings = useAiSettings(organizationId);
  const conversation = useConversation(conversationId);
  const generation = useAiGeneration(organizationId);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState<"CONVERSATION" | "ORGANIZATION">(
    conversationId ? "CONVERSATION" : "ORGANIZATION",
  );
  const [accepted, setAccepted] = useState(false);
  const eligibleConversation =
    conversation.data &&
    (conversation.data.type === "DIRECT" || conversation.data.kind === "TEXT");

  useEffect(() => {
    generation.reset();
    setMessages([]);
    setPrompt("");
  }, [generation.reset, organizationId]);

  useEffect(() => {
    if (!conversationId && scope === "CONVERSATION") setScope("ORGANIZATION");
  }, [conversationId, scope]);

  const updateSettings = useMutation({
    mutationFn: (enabled: boolean) =>
      aiApi.updateSettings(organizationId, {
        enabled,
        disclosureVersion: settings.data?.disclosureVersion ?? "",
        ...(enabled ? { acceptsProviderDataUse: true as const } : {}),
      }),
    onSuccess: (next) =>
      queryClient.setQueryData(queryKeys.ai.settings(organizationId), next),
  });
  const acceptConsent = useMutation({
    mutationFn: () =>
      aiApi.acceptConsent(organizationId, {
        disclosureVersion: settings.data?.disclosureVersion ?? "",
        acceptsProviderDataUse: true,
      }),
    onSuccess: (next) =>
      queryClient.setQueryData(queryKeys.ai.settings(organizationId), next),
  });
  const revokeConsent = useMutation({
    mutationFn: () => aiApi.revokeConsent(organizationId),
    onSuccess: (next) => {
      generation.reset();
      setMessages([]);
      queryClient.setQueryData(queryKeys.ai.settings(organizationId), next);
    },
  });

  const addAssistantResult = (result: {
    text: string;
    sources: AiWorkspaceSource[];
  }) => {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.text,
        sources: result.sources,
      },
    ]);
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || generation.status === "streaming") return;
    const history = messages
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: question },
    ]);
    setPrompt("");
    try {
      const result = await generation.start({
        task: AiTask.ASK,
        prompt: question,
        scope:
          scope === AiScopeKind.CONVERSATION && conversationId
            ? { kind: AiScopeKind.CONVERSATION, conversationId }
            : { kind: AiScopeKind.ORGANIZATION },
        ...(history.length ? { history } : {}),
      });
      addAssistantResult(result);
    } catch {
      // The hook exposes the request error in the panel.
    } finally {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ai.settings(organizationId),
      });
    }
  };

  const summarize = async (mode: "SUMMARY" | "ACTION_ITEMS") => {
    if (!conversationId || generation.status === "streaming") return;
    const label =
      mode === AiSummaryMode.SUMMARY
        ? "Summarize this conversation"
        : "Extract action items";
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: label },
    ]);
    try {
      addAssistantResult(
        await generation.start({
          task: AiTask.SUMMARIZE,
          conversationId,
          mode,
        }),
      );
    } catch {
      // The hook exposes the request error in the panel.
    } finally {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ai.settings(organizationId),
      });
    }
  };

  const enabled = settings.data?.organizationEnabled;
  const consented = settings.data?.userConsentAccepted;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 border-primary/20 bg-popover/98 p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b border-border p-5 pr-14">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <Bot className="size-5" aria-hidden />
            </span>
            <div>
              <SheetTitle>Echo</SheetTitle>
              <SheetDescription>
                Authorized workspace assistance
              </SheetDescription>
            </div>
            <Badge variant="outline" className="ml-auto">
              Beta
            </Badge>
          </div>
        </SheetHeader>

        {settings.isPending ? (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            Checking Echo access...
          </div>
        ) : settings.isError || !settings.data ? (
          <div className="p-5">
            <FormError>
              {settings.error?.message ?? "Echo settings are unavailable"}
            </FormError>
          </div>
        ) : !settings.data.available ? (
          <div className="m-5 rounded-2xl border border-dashed border-border p-5">
            <h3 className="font-semibold">Echo is not configured</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Configure the Gemini provider on the API before enabling this
              workspace.
            </p>
          </div>
        ) : !enabled ? (
          <div className="m-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <Sparkles className="size-5 text-primary" aria-hidden />
            <h3 className="mt-4 font-semibold">
              Enable Echo for this workspace
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {settings.data.dataUseNotice}
            </p>
            {settings.data.canManage ? (
              <>
                <label className="mt-4 flex gap-3 text-sm">
                  <input
                    id="ai-owner-disclosure"
                    name="aiOwnerDisclosure"
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  <span>
                    I authorize Gemini processing for messages members may
                    already access.
                  </span>
                </label>
                <Button
                  className="mt-4 w-full"
                  disabled={!accepted || updateSettings.isPending}
                  onClick={() => updateSettings.mutate(true)}
                >
                  <Check /> Enable Echo
                </Button>
              </>
            ) : (
              <p className="mt-4 text-sm font-medium">
                An organization owner must enable Echo.
              </p>
            )}
            {updateSettings.isError && (
              <div className="mt-3">
                <FormError>{updateSettings.error.message}</FormError>
              </div>
            )}
          </div>
        ) : !consented ? (
          <div className="m-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <h3 className="font-semibold">Your consent is required</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {settings.data.dataUseNotice}
            </p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              The owner has enabled Echo for authorized workspace messages. Echo
              can make mistakes.
            </p>
            <Button
              className="mt-4 w-full"
              disabled={acceptConsent.isPending}
              onClick={() => acceptConsent.mutate()}
            >
              Accept and continue
            </Button>
            {acceptConsent.isError && (
              <div className="mt-3">
                <FormError>{acceptConsent.error.message}</FormError>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="border-b border-border/70 p-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={scope === "CONVERSATION" ? "default" : "outline"}
                  disabled={!eligibleConversation}
                  onClick={() => setScope("CONVERSATION")}
                >
                  This conversation
                </Button>
                <Button
                  size="sm"
                  variant={scope === "ORGANIZATION" ? "default" : "outline"}
                  onClick={() => setScope("ORGANIZATION")}
                >
                  Workspace channels
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Clear Echo history"
                  onClick={() => {
                    generation.reset();
                    setMessages([]);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              {eligibleConversation && (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void summarize(AiSummaryMode.SUMMARY)}
                  >
                    Summarize
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void summarize(AiSummaryMode.ACTION_ITEMS)}
                  >
                    Action items
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="grid gap-4 p-4">
                {messages.length === 0 && !generation.text && (
                  <div className="rounded-2xl border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">
                    Ask about decisions, plans, or discussions in channels you
                    can access.
                  </div>
                )}
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "ml-8 rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground"
                        : "rounded-2xl border border-border bg-card/45 p-4 text-sm"
                    }
                  >
                    {message.role === "assistant" ? (
                      <>
                        <div className="prose prose-sm max-w-none text-foreground prose-p:leading-6">
                          <ReactMarkdown components={safeComponents}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2"
                          onClick={() =>
                            void navigator.clipboard.writeText(message.content)
                          }
                        >
                          <Copy /> Copy
                        </Button>
                        <SourceList
                          organizationId={organizationId}
                          sources={message.sources ?? []}
                          onNavigate={() => onOpenChange(false)}
                        />
                      </>
                    ) : (
                      message.content
                    )}
                  </article>
                ))}
                {generation.status === "streaming" && (
                  <article className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm">
                    {generation.text ? (
                      <ReactMarkdown components={safeComponents}>
                        {generation.text}
                      </ReactMarkdown>
                    ) : (
                      <span className="text-muted-foreground">Thinking...</span>
                    )}
                    <SourceList
                      organizationId={organizationId}
                      sources={generation.sources}
                      onNavigate={() => onOpenChange(false)}
                    />
                  </article>
                )}
                {generation.error && <FormError>{generation.error}</FormError>}
              </div>
            </ScrollArea>
            <form
              onSubmit={(event) => void ask(event)}
              className="border-t border-border bg-background/35 p-4"
            >
              <label htmlFor={inputId} className="sr-only">
                Ask Echo
              </label>
              <Textarea
                id={inputId}
                name="aiPrompt"
                value={prompt}
                maxLength={1000}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask about your workspace..."
                className="min-h-20 resize-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {settings.data.quota.userRemaining} requests left today
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={revokeConsent.isPending}
                  onClick={() => revokeConsent.mutate()}
                >
                  Revoke consent
                </Button>
                <span role="status" aria-live="polite" className="sr-only">
                  {generation.status === "streaming"
                    ? "AI response is generating"
                    : generation.status === "completed"
                      ? "AI response completed"
                      : ""}
                </span>
                {generation.status === "streaming" ? (
                  <Button
                    type="button"
                    className="ml-auto"
                    variant="outline"
                    onClick={generation.stop}
                  >
                    <Square /> Stop
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="ml-auto"
                    disabled={!prompt.trim()}
                  >
                    <Send /> Ask
                  </Button>
                )}
              </div>
              {revokeConsent.isError && (
                <div className="mt-2">
                  <FormError>{revokeConsent.error.message}</FormError>
                </div>
              )}
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
