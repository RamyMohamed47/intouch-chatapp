"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/lib/api/client";
import { AuthProvider } from "@/lib/auth/provider";
import { RealtimeProvider } from "@/lib/realtime/provider";

const shouldRetry = (failureCount: number, error: Error) =>
  failureCount < 1 && (!(error instanceof ApiError) || error.status >= 500);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: shouldRetry,
            staleTime: 15_000,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>{children}</RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
