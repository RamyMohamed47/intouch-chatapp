"use client";

import { MailPlus } from "lucide-react";
import { useState } from "react";

import { InviteMemberForm } from "@/components/memberships/invite-member-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InviteMemberDialog({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        aria-label="Invite a member"
        onClick={() => setOpen(true)}
      >
        <MailPlus /> <span className="hidden sm:inline">Invite member</span>
      </Button>
      <DialogContent>
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            {organizationName}
          </p>
          <DialogTitle>Invite a registered user</DialogTitle>
          <DialogDescription>
            Invitations add registered users to this organization as members.
          </DialogDescription>
        </DialogHeader>
        <InviteMemberForm organizationId={organizationId} className="mt-6" />
      </DialogContent>
    </Dialog>
  );
}
