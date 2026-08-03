export interface ReadReceiptEvent {
  id: string;
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: Date;
}

export interface ReadReceiptRealtime {
  readReceiptUpdated(receipt: ReadReceiptEvent): void;
}

export const createNoopReadReceiptRealtime = (): ReadReceiptRealtime => ({
  readReceiptUpdated() {},
});
