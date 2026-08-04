"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const themes = [
  {
    id: "ink",
    label: "Ink",
    description: "Deep navy and electric lime",
    swatches: ["#0d1120", "#c5f75a", "#252c40"],
    themeColor: "#0d1120",
  },
  {
    id: "cloud",
    label: "Cloud",
    description: "Airy white and crisp indigo",
    swatches: ["#f5f7fb", "#5a5fe8", "#dfe5f1"],
    themeColor: "#f5f7fb",
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Midnight violet and cyan",
    swatches: ["#171328", "#66e3f2", "#a99bff"],
    themeColor: "#171328",
  },
  {
    id: "ember",
    label: "Ember",
    description: "Espresso, coral, and rose",
    swatches: ["#211317", "#ff8b68", "#63333d"],
    themeColor: "#211317",
  },
] as const;

type ThemeId = (typeof themes)[number]["id"];

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("intouch-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      themes.find((item) => item.id === theme)?.themeColor ?? "#0d1120",
    );
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("ink");

  useEffect(() => {
    const saved = localStorage.getItem("intouch-theme");
    const nextTheme = themes.some((item) => item.id === saved)
      ? (saved as ThemeId)
      : "ink";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Choose appearance" />
        }
      >
        <Palette />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-3">
        <PopoverHeader className="px-1 pb-1">
          <PopoverTitle>Appearance</PopoverTitle>
          <PopoverDescription>
            Choose the atmosphere for your workspace.
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid grid-cols-2 gap-2">
          {themes.map((item) => {
            const selected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setTheme(item.id);
                  applyTheme(item.id);
                }}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent",
                  selected
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border",
                )}
              >
                <span className="flex w-full items-center">
                  <span className="flex -space-x-1.5" aria-hidden="true">
                    {item.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="size-5 rounded-full border border-background"
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </span>
                  {selected && (
                    <Check className="ml-auto size-4 text-primary" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
