"use client";

import { Smile } from "lucide-react";
import { useState } from "react";

import { EmojiPickerPanel } from "@/components/conversations/emoji-picker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ComposerEmojiPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Insert emoji"
            disabled={disabled}
          />
        }
      >
        <Smile />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-auto max-w-[calc(100vw-2rem)] p-2"
      >
        <PopoverHeader className="sr-only">
          <PopoverTitle>Insert emoji</PopoverTitle>
          <PopoverDescription>
            Search for an emoji to insert into your message.
          </PopoverDescription>
        </PopoverHeader>
        <EmojiPickerPanel
          onSelect={(emoji) => {
            onSelect(emoji);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
