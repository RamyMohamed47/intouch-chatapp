import { Suspense, type ReactNode } from "react";

import {
  ProtectedApp,
  ProtectedAppFallback,
} from "@/components/auth/protected-app";
import { AppShell } from "@/components/workspace/app-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ProtectedAppFallback />}>
      <ProtectedApp>
        <AppShell>{children}</AppShell>
      </ProtectedApp>
    </Suspense>
  );
}
