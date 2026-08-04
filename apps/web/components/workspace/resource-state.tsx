import { ArrowLeft, Compass, ShieldAlert } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

export function ResourceState({
  kind = "missing",
  title,
  description,
  href = "/app",
}: {
  kind?: "missing" | "forbidden";
  title: string;
  description: string;
  href?: string;
}) {
  const Icon = kind === "forbidden" ? ShieldAlert : Compass;
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
      <section className="max-w-md rounded-[2rem] border border-border bg-background/35 p-8 text-center shadow-xl">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <LinkButton className="mt-6 rounded-full" href={href}>
          <ArrowLeft /> Back to workspace
        </LinkButton>
      </section>
    </div>
  );
}
