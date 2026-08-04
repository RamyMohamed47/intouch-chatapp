export type OrganizationRole = "OWNER" | "MEMBER";
export type OrganizationVisibility = "PRIVATE" | "PUBLIC";
export type ConversationVisibility = "PRIVATE" | "PUBLIC";
export type PresenceStatus = "ONLINE" | "OFFLINE";

export interface DemoUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

export interface DemoOrganization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  visibility: OrganizationVisibility;
  currentUserRole: OrganizationRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoMemberUser extends DemoUser {
  status: PresenceStatus;
  lastSeenAt: string | null;
}

export interface DemoMembership {
  membershipId: string;
  organizationId: string;
  role: OrganizationRole;
  joinedAt: string;
  user: DemoMemberUser;
}

export interface DemoInvitation {
  id: string;
  organizationId: string;
  invitedUserId: string;
  invitedByUserId: string;
  expiresAt: string;
  createdAt: string;
}

export interface DemoCategory {
  id: string;
  organizationId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface DemoReadReceipt {
  id: string;
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}

interface DemoConversationBase {
  id: string;
  organizationId: string;
  unreadCount: number;
  readReceipt: DemoReadReceipt | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoChannelConversation extends DemoConversationBase {
  type: "CHANNEL";
  categoryId: string;
  name: string;
  visibility: ConversationVisibility;
  position: number;
  participantIds: string[];
}

export interface DemoDirectConversation extends DemoConversationBase {
  type: "DIRECT";
  participantIds: [string, string];
}

export type DemoConversation = DemoChannelConversation | DemoDirectConversation;

export interface DemoMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  messageType: "TEXT";
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface DemoWorkspaceState {
  currentUser: DemoUser;
  organizations: DemoOrganization[];
  memberships: DemoMembership[];
  invitations: DemoInvitation[];
  categories: DemoCategory[];
  conversations: DemoConversation[];
  messages: DemoMessage[];
}

export interface DemoActionResult {
  success: boolean;
  error?: string;
  id?: string;
}
