import { Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function SpeakingIndicator({
  className,
  displayName,
}: {
  className?: string;
  displayName: string;
}) {
  return (
    <span
      aria-label={`${displayName} is speaking`}
      className={cn(
        "grid size-5 place-items-center rounded-full border-2 border-card bg-status text-background shadow-sm",
        className,
      )}
      role="img"
    >
      <Volume2 className="size-2.5" aria-hidden="true" />
    </span>
  );
}
