import {
  ChannelKind,
  ConversationType,
  type ConversationDto,
  type DirectConversationDto,
} from "@intouch/shared/conversations";

export interface EchoConversationOption {
  id: string;
  label: string;
  type: "CHANNEL" | "DIRECT";
}

export const buildEchoConversationOptions = (
  channels: readonly ConversationDto[],
  directMessages: readonly DirectConversationDto[],
): EchoConversationOption[] => [
  ...channels
    .filter(
      (conversation) =>
        conversation.type === ConversationType.CHANNEL &&
        conversation.kind === ChannelKind.TEXT,
    )
    .map((conversation) => ({
      id: conversation.id,
      label: conversation.name,
      type: "CHANNEL" as const,
    })),
  ...directMessages.map((conversation) => ({
    id: conversation.id,
    label: conversation.peer.displayName,
    type: "DIRECT" as const,
  })),
];

export const filterEchoConversationOptions = (
  options: readonly EchoConversationOption[],
  query: string,
) => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...options];
  return options.filter(({ label }) =>
    label.toLocaleLowerCase().includes(normalized),
  );
};
