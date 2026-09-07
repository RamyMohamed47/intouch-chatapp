import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppearance } from "@/features/appearance/appearance-provider";

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastMessage {
  action?: ToastAction;
  message: string;
}

type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast>(() => {});

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { theme } = useAppearance();

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback((message: string, action?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, ...(action ? { action } : {}) });
    timer.current = setTimeout(() => {
      timer.current = null;
      setToast(null);
    }, 5000);
  }, []);

  useEffect(() => dismiss, [dismiss]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            {
              backgroundColor: theme.panelStrong,
              borderColor: theme.border,
              bottom: insets.bottom + 76,
            },
          ]}
        >
          <Text style={[styles.text, { color: theme.text }]}>
            {toast.message}
          </Text>
          {toast.action ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const action = toast.action;
                dismiss();
                action?.onPress();
              }}
              style={[styles.action, { borderColor: theme.border }]}
            >
              <Text style={[styles.actionText, { color: theme.accent }]}>
                {toast.action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  text: { flex: 1, fontSize: 14, fontWeight: "700" },
  action: {
    minHeight: 40,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    paddingLeft: 12,
  },
  actionText: { fontSize: 14, fontWeight: "900" },
});
