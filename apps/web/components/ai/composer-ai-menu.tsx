"use client";

import { AiComposeAction, AiTask } from "@intouch/shared/ai";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAiGeneration } from "@/lib/ai/use-ai-generation";
import { useAiSettings } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";

export function ComposerAiMenu({
  organizationId,
  draft,
  disabled,
  onReplace,
}: {
  organizationId: string;
  draft: string;
  disabled?: boolean;
  onReplace: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<keyof typeof AiComposeAction>(
    AiComposeAction.REWRITE_PROFESSIONAL,
  );
  const [targetLanguage, setTargetLanguage] = useState("English");
  const queryClient = useQueryClient();
  const settings = useAiSettings(organizationId);
  const generation = useAiGeneration(organizationId);

  useEffect(() => {
    if (!open) generation.reset();
  }, [generation.reset, open]);

  const generate = async () => {
    if (!draft.trim()) return;
    try {
      await generation.start({
        task: AiTask.COMPOSE,
        action,
        text: draft,
        ...(action === AiComposeAction.TRANSLATE ? { targetLanguage } : {}),
      });
    } catch {
      // The hook exposes the request error in the dialog.
    } finally {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ai.settings(organizationId),
      });
    }
  };

  const ready =
    settings.data?.available &&
    settings.data.organizationEnabled &&
    settings.data.userConsentAccepted;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Improve draft with InTouch AI"
        disabled={disabled || !draft.trim()}
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden />
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            AI writing tools
          </p>
          <DialogTitle>Refine your message</DialogTitle>
          <DialogDescription>
            Review the result before replacing your draft. Nothing is sent
            automatically.
          </DialogDescription>
        </DialogHeader>
        {!ready ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">
            Enable InTouch AI and accept its data-use disclosure before using
            writing tools.
            <Button
              className="mt-4 w-full"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event("intouch:open-ai"));
              }}
            >
              Open InTouch AI
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ai-compose-action">Action</Label>
                <Select
                  id="ai-compose-action"
                  name="aiComposeAction"
                  value={action}
                  onChange={(event) =>
                    setAction(
                      event.target.value as keyof typeof AiComposeAction,
                    )
                  }
                >
                  <option value={AiComposeAction.REWRITE_PROFESSIONAL}>
                    Rewrite professionally
                  </option>
                  <option value={AiComposeAction.SHORTEN}>Shorten</option>
                  <option value={AiComposeAction.FIX_GRAMMAR}>
                    Fix grammar
                  </option>
                  <option value={AiComposeAction.TRANSLATE}>Translate</option>
                </Select>
              </div>
              {action === AiComposeAction.TRANSLATE && (
                <div className="grid gap-2">
                  <Label htmlFor="ai-target-language">Target language</Label>
                  <input
                    id="ai-target-language"
                    name="aiTargetLanguage"
                    value={targetLanguage}
                    maxLength={40}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ai-original-draft">Original</Label>
                <Textarea
                  id="ai-original-draft"
                  name="aiOriginalDraft"
                  value={draft}
                  readOnly
                  className="mt-2 min-h-40 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="ai-generated-draft">AI suggestion</Label>
                <Textarea
                  id="ai-generated-draft"
                  name="aiGeneratedDraft"
                  value={generation.text}
                  readOnly
                  placeholder={
                    generation.status === "streaming"
                      ? "Generating..."
                      : "Generate a suggestion to preview it."
                  }
                  className="mt-2 min-h-40 resize-none"
                />
              </div>
            </div>
            {generation.error && (
              <div className="mt-3">
                <FormError>{generation.error}</FormError>
              </div>
            )}
            <DialogFooter>
              {generation.status === "streaming" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={generation.stop}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    action === AiComposeAction.TRANSLATE &&
                    !targetLanguage.trim()
                  }
                  onClick={() => void generate()}
                >
                  Generate
                </Button>
              )}
              <Button
                type="button"
                disabled={!generation.text || generation.status === "streaming"}
                onClick={() => {
                  onReplace(generation.text);
                  setOpen(false);
                }}
              >
                Replace draft
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
