"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { refreshAccessToken } from "@/lib/api/client";

type CallbackStatus = "loading" | "failed";

function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>("loading");

  useEffect(() => {
    if (searchParams.get("googleAuth") !== "success") {
      setStatus("failed");
      return;
    }

    void refreshAccessToken().then((accessToken) => {
      if (accessToken) {
        router.replace("/");
        return;
      }
      setStatus("failed");
    });
  }, [router, searchParams]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">
          InTouch
        </p>
        <h1 className="mt-4 text-2xl font-semibold">
          {status === "loading" ? "Finishing sign in" : "Sign in failed"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {status === "loading"
            ? "Securing your session and preparing your workspace."
            : "Google authentication could not be completed. Please try again."}
        </p>
        {status === "failed" && (
          <Link
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            href="/"
          >
            Return to InTouch
          </Link>
        )}
      </section>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallback />
    </Suspense>
  );
}
