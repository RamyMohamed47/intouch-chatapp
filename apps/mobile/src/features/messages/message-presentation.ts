import type { MessageDto, ReadReceiptDto } from "@intouch/shared/messages";

export const hasReadMessage = (
  receipt: ReadReceiptDto | null | undefined,
  messageId: string,
) => Boolean(receipt && receipt.lastReadMessageId >= messageId);

export const callMessageLabel = (
  message: MessageDto,
  currentUserId?: string,
) => {
  const call = message.call;
  const media = call?.mediaMode === "VIDEO" ? "Video" : "Voice";
  if (!call) return "Voice call";
  if (call.status !== "ENDED") return `${media} call in progress`;
  if (call.endReason === "MISSED") {
    return call.recipientUserId === currentUserId
      ? `Missed ${media.toLowerCase()} call`
      : `${media} call was not answered`;
  }
  if (call.endReason === "DECLINED") return `${media} call declined`;
  if (call.endReason === "CANCELLED") return `${media} call cancelled`;
  if (call.endReason === "FAILED") return `${media} call failed`;
  if (call.endReason === "ACCESS_REVOKED") return `${media} call ended`;
  const duration = call.durationSeconds ?? 0;
  return `${media} call - ${Math.floor(duration / 60)}:${String(
    duration % 60,
  ).padStart(2, "0")}`;
};
