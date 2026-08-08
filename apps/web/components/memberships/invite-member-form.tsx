"use client";

import { MailPlus } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inviteMemberSchema } from "@intouch/shared/memberships";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { membershipsApi } from "@/lib/api/memberships";
import { queryKeys } from "@/lib/query/keys";
import { cn, getFormString } from "@/lib/utils";

type InviteFeedback = { tone: "error" | "success"; message: string } | null;

const firstIssue = (error: { issues: { message: string }[] }) =>
  error.issues[0]?.message ?? "The submitted values are invalid";

export function InviteMemberForm({
  organizationId,
  className,
}: {
  organizationId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<InviteFeedback>(null);
  const invite = useMutation({
    mutationFn: (email: string) =>
      membershipsApi.invite(organizationId, { email }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all }),
  });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invite.isPending) return;

    setFeedback(null);
    const form = event.currentTarget;
    const parsed = inviteMemberSchema.safeParse({
      email: getFormString(new FormData(form), "email"),
    });
    if (!parsed.success) {
      setFeedback({ tone: "error", message: firstIssue(parsed.error) });
      return;
    }

    invite.mutate(parsed.data.email, {
      onSuccess: () => {
        form.reset();
        setFeedback({ tone: "success", message: "Invitation created." });
      },
      onError: (error) =>
        setFeedback({ tone: "error", message: error.message }),
    });
  };

  return (
    <form className={cn("grid gap-5", className)} onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor={`invite-email-${organizationId}`}>Email address</Label>
        <Input
          id={`invite-email-${organizationId}`}
          name="email"
          type="email"
          placeholder="person@company.com"
          disabled={invite.isPending}
        />
      </div>
      {feedback?.tone === "error" && <FormError>{feedback.message}</FormError>}
      {feedback?.tone === "success" && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs leading-5 text-status"
        >
          {feedback.message}
        </p>
      )}
      <Button
        type="submit"
        className="w-fit rounded-full"
        disabled={invite.isPending}
      >
        <MailPlus /> {invite.isPending ? "Sending..." : "Send invitation"}
      </Button>
    </form>
  );
}
