"use client";

import { Toast } from "@base-ui/react/toast";
import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

interface NotificationData {
  href?: string;
}

interface NotificationInput {
  id: string;
  title: string;
  description: string;
  href?: string;
}

interface NotificationContextValue {
  notify: (input: NotificationInput) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

function NotificationViewport() {
  const router = useRouter();
  const manager = Toast.useToastManager<NotificationData>();

  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 bottom-4 z-100 mx-auto flex w-[calc(100vw-2rem)] max-w-sm flex-col-reverse gap-3 outline-none sm:right-6 sm:bottom-6">
        {manager.toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="relative w-full origin-bottom rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-xl transition-[transform,opacity] duration-300 data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0"
          >
            <Toast.Content className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Toast.Title className="text-sm font-semibold" />
                <Toast.Description className="mt-1 text-sm text-muted-foreground" />
                {toast.data?.href && (
                  <Toast.Action
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      manager.close(toast.id);
                      router.push(toast.data?.href ?? "/app");
                    }}
                  >
                    Open conversation
                    <ArrowRight className="size-3" aria-hidden />
                  </Toast.Action>
                )}
              </div>
              <Toast.Close
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Dismiss notification"
              >
                <X className="size-4" aria-hidden />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function NotificationBridge({ children }: { children: ReactNode }) {
  const manager = Toast.useToastManager<NotificationData>();
  const addToast = manager.add;
  const notify = useCallback(
    (input: NotificationInput) => {
      addToast({
        id: input.id,
        title: input.title,
        description: input.description,
        priority: "low",
        data: input.href ? { href: input.href } : {},
      });
    },
    [addToast],
  );
  const contextValue = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationViewport />
    </NotificationContext.Provider>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={3} timeout={6_000}>
      <NotificationBridge>{children}</NotificationBridge>
    </Toast.Provider>
  );
}

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
};
