"use client";

import { Check, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { googleAuthRedirectQuerySchema } from "@intouch/shared/auth";

import { BrandLockup } from "@/components/brand/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LinkButton } from "@/components/ui/link-button";
import { useAuth } from "@/lib/auth/provider";
import { getSafeReturnPath } from "@/lib/auth/return-path";

function CallbackState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { restore } = useAuth();
  const [restoreFailed, setRestoreFailed] = useState(false);
  const result = googleAuthRedirectQuerySchema.safeParse({
    googleAuth: searchParams.get("googleAuth") ?? undefined,
  });
  const status = result.success ? result.data.googleAuth : undefined;
  const isSuccess = status === "success" && !restoreFailed;
  const isFailure = status === "failed" || restoreFailed;
  const Icon = isSuccess ? Check : isFailure ? X : LoaderCircle;

  useEffect(() => {
    if (status !== "success") return;
    const storedPath = sessionStorage.getItem("intouch:auth-return-path");
    sessionStorage.removeItem("intouch:auth-return-path");
    void restore().then((user) => {
      if (!user) {
        setRestoreFailed(true);
        return;
      }
      router.replace(getSafeReturnPath(storedPath));
    });
  }, [restore, router, status]);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background p-6 text-foreground">
      <div className="absolute top-5 right-5">
        <ThemeSwitcher />
      </div>
      <div className="absolute top-1/4 left-1/4 size-72 rounded-full bg-primary/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-border bg-card/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <BrandLockup className="mx-auto mb-6 h-36 w-full max-w-xs" preload />
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
          Google authentication
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
            ? "Your session is secure. Redirecting to your workspace now."
            : isFailure
              ? "Return to login and try the Google sign-in flow again."
              : "Google is returning control to InTouch. This should only take a moment."}
        </p>
        <div className="mt-7 flex flex-col gap-2">
          {isSuccess && (
            <p className="text-xs text-muted-foreground">Redirecting...</p>
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
