export interface ReadReceiptEvent {
  id: string;
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: Date;
}

export interface ReadReceiptRealtime {
  readReceiptUpdated(receipt: ReadReceiptEvent): void;
  channelReadReceiptsChanged(
    conversationId: string,
    excludedUserId: string,
  ): void;
}

export const createNoopReadReceiptRealtime = (): ReadReceiptRealtime => ({
  readReceiptUpdated() {},
  channelReadReceiptsChanged() {},
});
