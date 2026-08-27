export const CONVERSATION_BOTTOM_THRESHOLD_PX = 120;

export const isNearConversationBottom = (
  {
    clientHeight,
    scrollHeight,
    scrollTop,
  }: { clientHeight: number; scrollHeight: number; scrollTop: number },
  threshold = CONVERSATION_BOTTOM_THRESHOLD_PX,
) => scrollHeight - scrollTop - clientHeight <= threshold;

export const restoredScrollTop = ({
  previousHeight,
  previousTop,
  currentHeight,
}: {
  previousHeight: number;
  previousTop: number;
  currentHeight: number;
}) => previousTop + (currentHeight - previousHeight);

export const shouldSendMessageFromKey = ({
  isComposing,
  key,
  shiftKey,
}: {
  isComposing: boolean;
  key: string;
  shiftKey: boolean;
}) => key === "Enter" && !shiftKey && !isComposing;

export const insertEmojiAtSelection = ({
  content,
  emoji,
  end,
  maxLength = 4_000,
  start,
}: {
  content: string;
  emoji: string;
  end: number;
  maxLength?: number;
  start: number;
}) => {
  const nextContent = `${content.slice(0, start)}${emoji}${content.slice(end)}`;
  if (nextContent.length > maxLength) return null;
  return { content: nextContent, caret: start + emoji.length };
};
