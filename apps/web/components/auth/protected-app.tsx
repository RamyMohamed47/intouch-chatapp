"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand";
import { useAuth } from "@/lib/auth/provider";

export function ProtectedApp({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const query = searchParams.toString();
    const returnPath = `${pathname}${query ? `?${query}` : ""}`;
    router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
  }, [pathname, router, searchParams, status]);

  if (status !== "authenticated") {
    return <ProtectedAppFallback redirecting={status === "unauthenticated"} />;
  }

  return children;
}

export function ProtectedAppFallback({
  redirecting = false,
}: {
  redirecting?: boolean;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm text-center">
        <BrandLockup className="mx-auto h-44 w-full" preload />
        <p className="mt-4 text-sm text-muted-foreground">
          {redirecting
            ? "Redirecting to sign in..."
            : "Restoring your workspace..."}
        </p>
      </div>
    </main>
  );
}
