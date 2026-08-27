"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import type {
  EmojiClickData,
  EmojiStyle,
  PickerProps,
  Theme,
} from "emoji-picker-react";

const Picker = dynamic(
  () =>
    import("emoji-picker-react").then(
      (module) => module.default as ComponentType<PickerProps>,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-80 w-full place-items-center text-sm text-muted-foreground">
        Loading emoji...
      </div>
    ),
  },
);

const pickerTheme = () =>
  document.documentElement.dataset.theme === "cloud"
    ? ("light" as Theme)
    : ("dark" as Theme);

export function EmojiPickerPanel({
  onSelect,
  ...props
}: {
  onSelect: (emoji: string) => void;
} & Omit<ComponentProps<typeof Picker>, "onEmojiClick">) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === "undefined" ? ("dark" as Theme) : pickerTheme(),
  );

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(pickerTheme()));
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, []);

  return (
    <Picker
      {...props}
      emojiStyle={"native" as EmojiStyle}
      theme={theme}
      width="min(350px, calc(100vw - 2.5rem))"
      height={400}
      lazyLoadEmojis
      previewConfig={{ showPreview: false }}
      onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
    />
  );
}
