"use client";

import { ArrowRight, Check, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { LinkButton } from "@/components/ui/link-button";

function CallbackState() {
  const searchParams = useSearchParams();
  const status = searchParams.get("googleAuth");
  const isSuccess = status === "success";
  const isFailure = status === "failed";
  const Icon = isSuccess ? Check : isFailure ? X : LoaderCircle;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background p-6 text-foreground">
      <div className="absolute top-5 right-5">
        <ThemeSwitcher />
      </div>
      <div className="absolute top-1/4 left-1/4 size-72 rounded-full bg-primary/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-border bg-card/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <span
          className={`mx-auto grid size-16 place-items-center rounded-2xl ${
            isFailure
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          }`}
        >
          <Icon
            className={`size-7 ${!isSuccess && !isFailure ? "animate-spin" : ""}`}
          />
        </span>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
          Google authentication preview
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {isSuccess
            ? "Your workspace is ready."
            : isFailure
              ? "Sign in did not complete."
              : "Finishing sign in."}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isSuccess
            ? "This frontend preview can now continue into the application shell."
            : isFailure
              ? "Return to login and try the flow again when authentication is connected."
              : "This is the static processing state. No session request is being made."}
        </p>
        <div className="mt-7 flex flex-col gap-2">
          {isSuccess && (
            <LinkButton className="h-10 rounded-full" href="/app">
              Continue to workspace <ArrowRight />
            </LinkButton>
          )}
          {isFailure && (
            <LinkButton
              variant="outline"
              className="h-10 rounded-full"
              href="/login"
            >
              <RotateCcw /> Return to login
            </LinkButton>
          )}
        </div>
      </section>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <CallbackState />
    </Suspense>
  );
}
