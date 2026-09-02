import type {
  CallEndReasonValue,
  CallStatusValue,
  VoiceSessionKindValue,
} from "@intouch/shared/voice";
import type { Types } from "mongoose";

export interface CallSession {
  organizationId: Types.ObjectId;
  conversationId: Types.ObjectId;
  callerUserId: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  providerRoomId: string;
  timelineMessageId?: Types.ObjectId;
  status: CallStatusValue;
  endReason?: CallEndReasonValue;
  startedAt: Date;
  acceptedAt?: Date;
  answeredAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallSessionRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  callerUserId: string;
  recipientUserId: string;
  providerRoomId: string;
  timelineMessageId?: string;
  status: CallStatusValue;
  endReason: CallEndReasonValue | null;
  startedAt: Date;
  acceptedAt: Date | null;
  answeredAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCallSessionRecordInput {
  id: string;
  organizationId: string;
  conversationId: string;
  callerUserId: string;
  recipientUserId: string;
  providerRoomId: string;
  startedAt: Date;
}

export interface VoiceSessionRecord {
  id: string;
  kind: VoiceSessionKindValue;
  organizationId: string;
  conversationId: string;
  callId: string | null;
  userId: string;
  participantIdentity: string;
  providerRoomId: string;
  connectedAt: Date | null;
}

export interface VoiceWebhookEvent {
  id: string;
  kind:
    | "participant_joined"
    | "participant_left"
    | "participant_connection_aborted"
    | "room_finished"
    | "other";
  providerRoomId: string | null;
  participantIdentity: string | null;
}
