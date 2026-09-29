import {
  ChannelKind,
  ConversationType,
  ConversationVisibility,
  type ChannelKindValue,
  type ConversationTypeValue,
  type ConversationVisibilityType,
} from "@intouch/shared/conversations";

export const shouldLoadConversationMessages = (conversation: {
  kind?: ChannelKindValue;
  type: ConversationTypeValue;
}) =>
  conversation.type === ConversationType.DIRECT ||
  (conversation.type === ConversationType.CHANNEL &&
    conversation.kind === ChannelKind.TEXT);

export const shouldLoadConversationParticipants = (conversation: {
  type: ConversationTypeValue;
  visibility?: ConversationVisibilityType;
}) =>
  conversation.type === ConversationType.CHANNEL &&
  conversation.visibility === ConversationVisibility.PRIVATE;

export const shouldPositionAtLatestMessage = (input: {
  anchorMessageId: string;
  conversationId: string;
  messageCount: number;
  positionedConversationId: string | null;
}) =>
  !input.anchorMessageId &&
  input.messageCount > 0 &&
  input.positionedConversationId !== input.conversationId;
