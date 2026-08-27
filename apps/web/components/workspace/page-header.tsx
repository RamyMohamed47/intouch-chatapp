import type { ReactNode } from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-h-[82px] shrink-0 items-center gap-4 border-b border-border/70 px-5 py-4 md:px-7",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
          {title}
        </h1>
        {description && (
          <div className="mt-1 hidden truncate text-xs text-muted-foreground sm:block">
            {description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="hidden md:block">
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
