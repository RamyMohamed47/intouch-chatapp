import type {
  ConversationTypeValue,
  ConversationVisibilityType,
  CreateConversationInput,
  UpdateConversationInput,
} from "@intouch/shared/conversations";
import type { Types } from "mongoose";
import type { MembershipRole } from "../memberships/index.js";
import type { PublicUser } from "../user/user.types.js";

export interface Conversation {
  organizationId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  nameKey: string;
  type: ConversationTypeValue;
  visibility: ConversationVisibilityType;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationRecord {
  id: string;
  organizationId: string;
  categoryId: string;
  name: string;
  type: ConversationTypeValue;
  visibility: ConversationVisibilityType;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationRecordInput {
  organizationId: string;
  categoryId: string;
  name: string;
  nameKey: string;
  type: ConversationTypeValue;
  visibility: ConversationVisibilityType;
  position: number;
}

export interface UpdateConversationRecordInput {
  categoryId?: string;
  name?: string;
  nameKey?: string;
  visibility?: ConversationVisibilityType;
  position?: number;
}

export interface ConversationParticipant {
  organizationId: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  addedByUserId: Types.ObjectId;
  joinedAt: Date;
}

export interface ConversationParticipantRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  userId: string;
  addedByUserId: string;
  joinedAt: Date;
}

export interface ConversationParticipantView extends ConversationParticipantRecord {
  user: Pick<
    PublicUser,
    "id" | "username" | "displayName" | "avatarUrl" | "status"
  >;
}

export interface OrganizationMemberView {
  membershipId: string;
  role: MembershipRole;
  joinedAt: Date;
  user: Pick<
    PublicUser,
    "id" | "username" | "displayName" | "avatarUrl" | "status"
  >;
}

export type { CreateConversationInput, UpdateConversationInput };
