import type {
  MessageListResponse,
  MessageReactionStateDto,
} from "@intouch/shared/messages";
import type { InfiniteData } from "@tanstack/react-query";

export const mergeReactionStateIntoMessagePages = (
  current: InfiniteData<MessageListResponse> | undefined,
  reactionState: MessageReactionStateDto,
) => {
  if (!current) return current;
  let changed = false;
  const pages = current.pages.map((page) => {
    let pageChanged = false;
    const messages = page.messages.map((message) => {
      if (message.id !== reactionState.messageId) return message;
      const sameSummaries =
        message.reactions.length === reactionState.reactions.length &&
        message.reactions.every(
          (reaction, index) =>
            reaction.emoji === reactionState.reactions[index]?.emoji &&
            reaction.count === reactionState.reactions[index]?.count,
        );
      if (
        sameSummaries &&
        message.currentUserReaction === reactionState.currentUserReaction
      ) {
        return message;
      }
      changed = true;
      pageChanged = true;
      return { ...message, ...reactionState };
    });
    return pageChanged ? { ...page, messages } : page;
  });
  return changed ? { ...current, pages } : current;
};
