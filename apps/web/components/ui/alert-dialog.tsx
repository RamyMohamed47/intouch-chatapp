"use client";

import {
  Dialog as AlertDialog,
  DialogClose as AlertDialogCancel,
  DialogContent,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
  DialogTrigger as AlertDialogTrigger,
} from "@/components/ui/dialog";

function AlertDialogContent(props: React.ComponentProps<typeof DialogContent>) {
  return <DialogContent showCloseButton={false} {...props} />;
}

export {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
