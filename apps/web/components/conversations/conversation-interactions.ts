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
