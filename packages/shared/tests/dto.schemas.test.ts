import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  authResponseSchema,
  googleAuthRedirectQuerySchema,
  googleOAuthCallbackQuerySchema,
} from "../auth/index.js";
import { categoryResponseSchema } from "../categories/index.js";
import { errorResponseSchema } from "../common/index.js";
import {
  ConversationType,
  ConversationVisibility,
  conversationResponseSchema,
  directMessageResponseSchema,
} from "../conversations/index.js";
import {
  MembershipRole,
  invitationResponseSchema,
  membershipResponseSchema,
} from "../memberships/index.js";
import {
  MessageType,
  messageResponseSchema,
  readReceiptResponseSchema,
} from "../messages/index.js";
import {
  OrganizationVisibility,
  organizationResponseSchema,
} from "../organizations/index.js";
import {
  messageEventSchema,
  socketAcknowledgementSchema,
  socketHandshakeAuthSchema,
} from "../realtime/index.js";

const now = new Date("2026-08-05T12:00:00.000Z");
const id = "507f1f77bcf86cd799439011";

describe("shared DTO schemas", () => {
  test("serializes public auth users and strips private fields", () => {
    const result = authResponseSchema.parse({
      user: {
        id,
        username: "alex",
        displayName: "Alex Rivera",
        avatarAssetId: null,
        email: "alex@example.com",
        createdAt: now,
        updatedAt: now,
        passwordHash: "must-not-leak",
        loginProviders: [{ provider: "PASSWORD" }],
      },
      accessToken: "access-token",
      refreshToken: "must-not-leak",
    });

    assert.deepEqual(result, {
      user: {
        id,
        username: "alex",
        displayName: "Alex Rivera",
        avatarAssetId: null,
        email: "alex@example.com",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      accessToken: "access-token",
    });
  });

  test("serializes organization, category, membership, and invitation DTOs", () => {
    const organization = organizationResponseSchema.parse({
      organization: {
        id,
        name: "Northstar",
        slug: "northstar",
        logoAssetId: null,
        visibility: OrganizationVisibility.PRIVATE,
        currentUserRole: MembershipRole.OWNER,
        createdAt: now,
        updatedAt: now,
        mutationVersion: 3,
      },
    });
    assert.equal(organization.organization.createdAt, now.toISOString());
    assert.ok(!("mutationVersion" in organization.organization));

    const category = categoryResponseSchema.parse({
      category: {
        id,
        organizationId: id,
        name: "Product",
        position: 0,
        createdAt: now,
        updatedAt: now,
        nameKey: "product",
      },
    });
    assert.ok(!("nameKey" in category.category));

    const membership = membershipResponseSchema.parse({
      membership: {
        id,
        userId: id,
        organizationId: id,
        role: MembershipRole.MEMBER,
        joinedAt: now,
      },
    });
    assert.equal(membership.membership.joinedAt, now.toISOString());

    const invitation = invitationResponseSchema.parse({
      invitation: {
        id,
        organizationId: id,
        invitedUserId: id,
        invitedByUserId: id,
        expiresAt: now,
        createdAt: now,
        organization: {
          id,
          name: "Northstar",
          slug: "northstar",
          logoAssetId: null,
          visibility: OrganizationVisibility.PRIVATE,
        },
      },
    });
    assert.equal(invitation.invitation.expiresAt, now.toISOString());
  });

  test("serializes message, receipt, channel, and direct-message DTOs", () => {
    const message = {
      id,
      conversationId: id,
      senderId: id,
      content: "Hello",
      messageType: MessageType.TEXT,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      reactions: [{ emoji: "👍", count: 2 }],
      currentUserReaction: "👍",
    };
    const receipt = {
      id,
      conversationId: id,
      userId: id,
      lastReadMessageId: id,
      lastReadAt: now,
    };

    assert.equal(
      messageResponseSchema.parse({ message }).message.createdAt,
      now.toISOString(),
    );
    assert.equal(
      readReceiptResponseSchema.parse({ readReceipt: receipt }).readReceipt
        .lastReadAt,
      now.toISOString(),
    );

    const channel = conversationResponseSchema.parse({
      conversation: {
        id,
        organizationId: id,
        categoryId: id,
        name: "general",
        type: ConversationType.CHANNEL,
        visibility: ConversationVisibility.PUBLIC,
        position: 0,
        createdAt: now,
        updatedAt: now,
        lastMessage: message,
        unreadCount: 2,
        readReceipt: receipt,
        activityAt: now,
      },
    });
    assert.ok(!("activityAt" in channel.conversation));

    const direct = directMessageResponseSchema.parse({
      directMessage: {
        id,
        organizationId: id,
        type: ConversationType.DIRECT,
        peer: {
          id,
          username: "maya",
          displayName: "Maya Chen",
        },
        lastMessage: message,
        unreadCount: 1,
        readReceipt: receipt,
        peerReadReceipt: null,
        createdAt: now,
        updatedAt: now,
        directParticipantKey: "private",
      },
    });
    assert.ok(!("directParticipantKey" in direct.directMessage));
    assert.equal(direct.directMessage.peerReadReceipt, null);
    assert.equal(
      directMessageResponseSchema.safeParse({
        directMessage: {
          ...direct.directMessage,
          peerReadReceipt: undefined,
        },
      }).success,
      false,
    );
  });

  test("derives and validates REST error and Socket.IO DTOs", () => {
    assert.equal(
      googleOAuthCallbackQuerySchema.parse({ state: "state", code: "code" })
        .code,
      "code",
    );
    assert.equal(
      googleAuthRedirectQuerySchema.safeParse({ googleAuth: "unknown" })
        .success,
      false,
    );
    assert.equal(
      errorResponseSchema.parse({
        success: false,
        error: { code: "NOT_FOUND", message: "Missing" },
      }).error.code,
      "NOT_FOUND",
    );
    assert.equal(
      errorResponseSchema.safeParse({
        success: false,
        error: { code: "CONVERSATION_NOT_FOUND", message: "Missing" },
      }).success,
      false,
    );
    const acknowledgement = socketAcknowledgementSchema.parse({
      success: false,
      error: { code: "CONVERSATION_NOT_FOUND", message: "Missing" },
    });
    assert.equal(acknowledgement.success, false);
    if (acknowledgement.success)
      assert.fail("Expected a failed acknowledgement");
    assert.equal(acknowledgement.error.code, "CONVERSATION_NOT_FOUND");
    assert.equal(
      socketHandshakeAuthSchema.safeParse({
        accessToken: "token",
        extra: true,
      }).success,
      false,
    );
    assert.equal(
      messageEventSchema.parse({
        id,
        conversationId: id,
        senderId: id,
        content: "Hello",
        messageType: MessageType.TEXT,
        editedAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }).createdAt,
      now.toISOString(),
    );
  });
});
