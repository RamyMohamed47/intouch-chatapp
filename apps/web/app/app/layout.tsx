import type { ReactNode } from "react";

import { AppShell } from "@/components/workspace/app-shell";
import { DemoWorkspaceProvider } from "@/lib/demo/provider";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <DemoWorkspaceProvider>
      <AppShell>{children}</AppShell>
    </DemoWorkspaceProvider>
  );
}
