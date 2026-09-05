import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";

import {
  ChannelKind,
  conversationResponseSchema,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import { ChatWallpaperId } from "@intouch/shared/chat-wallpapers";
import { OrganizationVisibility } from "@intouch/shared/organizations";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

import CategoryModel from "../src/modules/categories/category.model.js";
import createMongooseCategoryRepository from "../src/modules/categories/category.repository.js";
import createCategoryService from "../src/modules/categories/category.service.js";
import createMongooseChatWallpaperRepository from "../src/modules/chat-wallpapers/chat-wallpaper.repository.js";
import ChatWallpaperPreferenceModel from "../src/modules/chat-wallpapers/chat-wallpaper.model.js";
import createMongooseConversationActivityAudienceRepository from "../src/modules/conversation-activity/conversation-activity.repository.js";
import ConversationParticipantModel from "../src/modules/conversations/conversation-participant.model.js";
import createMongooseConversationParticipantRepository from "../src/modules/conversations/conversation-participant.repository.js";
import ConversationModel from "../src/modules/conversations/conversation.model.js";
import createConversationPolicy from "../src/modules/conversations/conversation.policy.js";
import { createNoopConversationRealtime } from "../src/modules/conversations/conversation.realtime.js";
import createMongooseConversationRepository from "../src/modules/conversations/conversation.repository.js";
import createConversationService from "../src/modules/conversations/conversation.service.js";
import createDirectMessageService from "../src/modules/direct-messages/direct-message.service.js";
import createMongooseInvitationRepository from "../src/modules/invitations/invitation.repository.js";
import MembershipModel from "../src/modules/memberships/membership.model.js";
import createMongooseMembershipRepository from "../src/modules/memberships/membership.repository.js";
import createMembershipService from "../src/modules/memberships/membership.service.js";
import MessageModel from "../src/modules/message/message.model.js";
import createMongooseMessageRepository from "../src/modules/message/message.repository.js";
import MessageReactionModel from "../src/modules/message-reactions/message-reaction.model.js";
import createMongooseMessageReactionRepository from "../src/modules/message-reactions/message-reaction.repository.js";
import createMongooseNotificationRepository from "../src/modules/notifications/notification.repository.js";
import createMongooseConversationSummaryRepository from "../src/modules/message/conversation-summary.repository.js";
import createMessageService from "../src/modules/message/message.service.js";
import { MessageType } from "../src/modules/message/message.types.js";
import OrganizationModel from "../src/modules/organizations/organization.model.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";
import createMongooseOrganizationRepository from "../src/modules/organizations/organization.repository.js";
import createOrganizationService from "../src/modules/organizations/organization.service.js";
import createMongooseOrganizationUnitOfWork, {
  type OrganizationUnitOfWork,
} from "../src/modules/organizations/organization.unit-of-work.js";
import { createMongooseStoredAssetRepository } from "../src/modules/uploads/index.js";
import createMongooseUserRepository from "../src/modules/user/user.repository.js";
import { UserModel } from "../src/modules/user/user.model.js";
import ConversationReadStateModel from "../src/modules/read-receipts/read-receipt.model.js";
import createMongooseConversationReadStateRepository from "../src/modules/read-receipts/read-receipt.repository.js";
import { createMongooseMailOutboxRepository } from "../src/modules/mail/index.js";
import { backfillChannelKinds } from "../src/migrations/backfillChannelKinds.js";
import { backfillCallMediaModes } from "../src/migrations/backfillCallMediaModes.js";
import CallSessionModel from "../src/modules/voice/call.model.js";

const ownerId = "507f1f77bcf86cd799439011";
const memberId = "507f1f77bcf86cd799439012";
let replicaSet: MongoMemoryReplSet;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri("intouch-conversations"));
  await Promise.all([
    OrganizationModel.syncIndexes(),
    MembershipModel.syncIndexes(),
    CategoryModel.syncIndexes(),
    ConversationModel.syncIndexes(),
    ConversationParticipantModel.syncIndexes(),
    MessageModel.syncIndexes(),
    MessageReactionModel.syncIndexes(),
    ConversationReadStateModel.syncIndexes(),
    ChatWallpaperPreferenceModel.syncIndexes(),
    UserModel.syncIndexes(),
    CallSessionModel.syncIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    OrganizationModel.deleteMany({}).exec(),
    MembershipModel.deleteMany({}).exec(),
    CategoryModel.deleteMany({}).exec(),
    ConversationModel.deleteMany({}).exec(),
    ConversationParticipantModel.deleteMany({}).exec(),
    MessageModel.deleteMany({}).exec(),
    MessageReactionModel.deleteMany({}).exec(),
    ConversationReadStateModel.deleteMany({}).exec(),
    ChatWallpaperPreferenceModel.deleteMany({}).exec(),
    UserModel.deleteMany({}).exec(),
    CallSessionModel.deleteMany({}).exec(),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

const createHarness = (
  unitOfWork = createMongooseOrganizationUnitOfWork(),
  conversationCreated: (
    conversation: { id: string },
    actorUserId: string,
  ) => Promise<void> = async () => undefined,
) => {
  const organizations = createMongooseOrganizationRepository();
  const memberships = createMembershipService(
    createMongooseMembershipRepository(),
  );
  const categories = createMongooseCategoryRepository();
  const conversations = createMongooseConversationRepository();
  const participants = createMongooseConversationParticipantRepository();
  const organizationPolicy = createOrganizationPolicy();
  const conversationService = createConversationService({
    categories,
    conversations,
    memberships,
    conversationSummaries: createMongooseConversationSummaryRepository(),
    organizations,
    participants,
    policy: createConversationPolicy(),
    organizationPolicy,
    realtime: createNoopConversationRealtime(),
    unitOfWork,
    users: createMongooseUserRepository(),
  });
  const messageService = createMessageService({
    activity: {
      messageCreated: async () => undefined,
      messageDeleted: async () => undefined,
      messageUpdated: async () => undefined,
    },
    broadcaster: {
      messageCreated() {},
      messageDeleted() {},
      messageUpdated() {},
    },
    conversationPolicy: createConversationPolicy(),
    conversations: conversationService,
    messages: createMongooseMessageRepository(),
    reactions: {
      decorate: async (_userId, _conversation, records) =>
        records.map((record) => ({
          ...record,
          reactions: [],
          currentUserReaction: null,
        })),
    },
    unitOfWork,
  });
  return {
    organizationService: createOrganizationService({
      organizations,
      memberships,
      unitOfWork,
      policy: organizationPolicy,
    }),
    categoryService: createCategoryService({
      categories,
      memberships,
      organizations,
      policy: organizationPolicy,
      unitOfWork,
    }),
    conversationService,
    directMessageService: createDirectMessageService({
      activity: { conversationCreated },
      conversations,
      memberships,
      organizations,
      organizationPolicy,
      summaries: conversationService,
      unitOfWork,
    }),
    memberships,
    messageService,
  };
};

const createOrganizationAndCategory = async () => {
  const harness = createHarness();
  const organization = await harness.organizationService.create(ownerId, {
    name: "Product Team",
    visibility: OrganizationVisibility.PRIVATE,
  });
  const category = await harness.categoryService.create(
    ownerId,
    organization.id,
    { name: "Product" },
  );
  return { ...harness, category, organization };
};

describe("category and conversation transactions", () => {
  test("serializes concurrent category and channel appends", async () => {
    const harness = createHarness();
    const organization = await harness.organizationService.create(ownerId, {
      name: "Concurrent Team",
      visibility: OrganizationVisibility.PRIVATE,
    });
    const createdCategories = await Promise.all([
      harness.categoryService.create(ownerId, organization.id, { name: "A" }),
      harness.categoryService.create(ownerId, organization.id, { name: "B" }),
    ]);
    assert.deepEqual(
      createdCategories.map(({ position }) => position).sort(),
      [0, 1],
    );

    const category = createdCategories[0];
    assert.ok(category);
    const createdChannels = await Promise.all([
      harness.conversationService.create(ownerId, organization.id, {
        categoryId: category.id,
        name: "one",
        visibility: ConversationVisibility.PUBLIC,
      }),
      harness.conversationService.create(ownerId, organization.id, {
        categoryId: category.id,
        name: "two",
        visibility: ConversationVisibility.PUBLIC,
      }),
    ]);
    assert.deepEqual(
      createdChannels.map(({ position }) => position).sort(),
      [0, 1],
    );
  });

  test("creates one idempotent direct conversation with exactly two participants", async () => {
    const activities: Array<{ conversationId: string; actorUserId: string }> =
      [];
    const harness = createHarness(
      createMongooseOrganizationUnitOfWork(),
      async (conversation, actorUserId) => {
        activities.push({ conversationId: conversation.id, actorUserId });
      },
    );
    const organization = await harness.organizationService.create(ownerId, {
      name: "Direct Team",
      visibility: OrganizationVisibility.PRIVATE,
    });
    const { directMessageService, memberships } = harness;
    await memberships.createMember(memberId, organization.id);

    const first = await directMessageService.create(ownerId, organization.id, {
      recipientUserId: memberId,
    });
    const second = await directMessageService.create(ownerId, organization.id, {
      recipientUserId: memberId,
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.directMessage.id, second.directMessage.id);
    assert.equal(await ConversationModel.countDocuments({ type: "DIRECT" }), 1);
    assert.equal(await ConversationParticipantModel.countDocuments(), 2);
    assert.deepEqual(activities, [
      { conversationId: first.directMessage.id, actorUserId: ownerId },
    ]);
  });

  test("rejects self direct messages and recipients outside the organization", async () => {
    const { directMessageService, organization } =
      await createOrganizationAndCategory();
    await assert.rejects(
      directMessageService.create(ownerId, organization.id, {
        recipientUserId: ownerId,
      }),
      /cannot create a direct message with yourself/i,
    );
    await assert.rejects(
      directMessageService.create(ownerId, organization.id, {
        recipientUserId: memberId,
      }),
      /recipient not found/i,
    );
  });

  test("converges concurrent DM creation on one conversation", async () => {
    const { directMessageService, memberships, organization } =
      await createOrganizationAndCategory();
    await memberships.createMember(memberId, organization.id);
    const results = await Promise.all([
      directMessageService.create(ownerId, organization.id, {
        recipientUserId: memberId,
      }),
      directMessageService.create(ownerId, organization.id, {
        recipientUserId: memberId,
      }),
    ]);
    assert.equal(
      new Set(results.map(({ directMessage }) => directMessage.id)).size,
      1,
    );
    assert.equal(await ConversationModel.countDocuments({ type: "DIRECT" }), 1);
    assert.equal(await ConversationParticipantModel.countDocuments(), 2);
  });

  test("computes DM previews and unread counts from durable read state", async () => {
    const {
      conversationService,
      directMessageService,
      memberships,
      messageService,
      organization,
    } = await createOrganizationAndCategory();
    await memberships.createMember(memberId, organization.id);
    const audiences = createMongooseConversationActivityAudienceRepository();
    assert.deepEqual(
      await audiences.listOrganizationMemberUserIds(organization.id, ownerId),
      [memberId],
    );
    const result = await directMessageService.create(ownerId, organization.id, {
      recipientUserId: memberId,
    });
    const ownMessage = await messageService.create(
      ownerId,
      result.directMessage.id,
      {
        content: "own message",
      },
    );
    const incoming = await messageService.create(
      memberId,
      result.directMessage.id,
      {
        content: "incoming",
      },
    );
    const page = await directMessageService.list(ownerId, organization.id, {
      limit: 30,
    });
    assert.equal(page.directMessages[0]?.lastMessage?.id, incoming.id);
    const [unread] = await conversationService.summarize(
      ownerId,
      [
        await createMongooseConversationRepository().findById(
          result.directMessage.id,
        ),
      ].filter((record) => record !== null),
    );
    assert.equal(unread?.lastMessage?.id, incoming.id);
    assert.equal(unread?.unreadCount, 1);

    const readStateRepository = createMongooseConversationReadStateRepository();
    const concurrentAdvances = await Promise.all([
      readStateRepository.advance({
        organizationId: organization.id,
        conversationId: result.directMessage.id,
        userId: ownerId,
        lastReadMessageId: incoming.id,
        lastReadAt: new Date(),
      }),
      readStateRepository.advance({
        organizationId: organization.id,
        conversationId: result.directMessage.id,
        userId: ownerId,
        lastReadMessageId: incoming.id,
        lastReadAt: new Date(),
      }),
    ]);
    assert.equal(
      concurrentAdvances.filter(({ advanced }) => advanced).length,
      1,
    );
    const stale = await readStateRepository.advance({
      organizationId: organization.id,
      conversationId: result.directMessage.id,
      userId: ownerId,
      lastReadMessageId: ownMessage.id,
      lastReadAt: new Date(),
    });
    assert.equal(stale.readState.lastReadMessageId, incoming.id);
    assert.equal(stale.advanced, false);
    const peerAdvance = await readStateRepository.advance({
      organizationId: organization.id,
      conversationId: result.directMessage.id,
      userId: memberId,
      lastReadMessageId: incoming.id,
      lastReadAt: new Date(),
    });
    assert.equal(peerAdvance.advanced, true);
    const record = await createMongooseConversationRepository().findById(
      result.directMessage.id,
    );
    assert.ok(record);
    const [read] = await conversationService.summarize(ownerId, [record]);
    assert.equal(read?.unreadCount, 0);
    assert.equal(read?.readReceipt?.lastReadMessageId, incoming.id);
    assert.equal(read?.peerReadReceipt?.userId, memberId);
    assert.equal(read?.peerReadReceipt?.lastReadMessageId, incoming.id);
  });

  test("creates a private channel and owner participant atomically", async () => {
    const { category, conversationService, organization } =
      await createOrganizationAndCategory();
    const conversation = await conversationService.create(
      ownerId,
      organization.id,
      {
        categoryId: category.id,
        name: "Leadership",
        visibility: ConversationVisibility.PRIVATE,
      },
    );
    assert.equal(conversation.position, 0);
    assert.equal(await ConversationModel.countDocuments(), 1);
    assert.equal(await ConversationParticipantModel.countDocuments(), 1);
  });

  test("hydrates voice-channel occupancy after creation and update", async () => {
    const { category, conversationService, organization } =
      await createOrganizationAndCategory();
    const conversation = await conversationService.create(
      ownerId,
      organization.id,
      {
        categoryId: category.id,
        kind: ChannelKind.VOICE,
        name: "Daily Standup",
        visibility: ConversationVisibility.PUBLIC,
      },
    );

    assert.equal(conversation.kind, ChannelKind.VOICE);
    assert.deepEqual(conversation.occupancy, {
      conversationId: conversation.id,
      capacity: 10,
      participantUserIds: [],
      participants: [],
    });
    assert.doesNotThrow(() =>
      conversationResponseSchema.parse({ conversation }),
    );

    const updated = await conversationService.update(ownerId, conversation.id, {
      name: "Team Standup",
    });

    assert.equal(updated.name, "Team Standup");
    assert.deepEqual(updated.occupancy, {
      conversationId: conversation.id,
      capacity: 10,
      participantUserIds: [],
      participants: [],
    });
    assert.doesNotThrow(() =>
      conversationResponseSchema.parse({
        conversation: updated,
      }),
    );
  });

  test("summarizes only current eligible channel readers", async () => {
    const { category, conversationService, memberships, organization } =
      await createOrganizationAndCategory();
    await memberships.createMember(memberId, organization.id);
    const readerAudiences =
      createMongooseConversationActivityAudienceRepository();
    await UserModel.create({
      _id: memberId,
      username: "member-reader",
      displayName: "Member Reader",
      email: "member-reader@example.com",
      loginProviders: [],
    });
    const conversation = await conversationService.create(
      ownerId,
      organization.id,
      {
        categoryId: category.id,
        name: "Reader Test",
        visibility: ConversationVisibility.PUBLIC,
      },
    );
    const message = await createMongooseMessageRepository().create({
      conversationId: conversation.id,
      senderId: ownerId,
      content: "read me",
      messageType: MessageType.TEXT,
    });
    const readStates = createMongooseConversationReadStateRepository();
    await readStates.advance({
      organizationId: organization.id,
      conversationId: conversation.id,
      userId: memberId,
      lastReadMessageId: message.id,
      lastReadAt: new Date(),
    });
    const input = {
      organizationId: organization.id,
      conversationId: conversation.id,
      messageId: message.id,
      senderId: ownerId,
      requireParticipant: false,
    };
    const publicSummary = await readStates.summarizeMessageReaders(input);
    assert.equal(publicSummary.readByCount, 1);
    assert.equal(publicSummary.readers[0]?.displayName, "Member Reader");

    assert.equal(
      (
        await readStates.summarizeMessageReaders({
          ...input,
          requireParticipant: true,
        })
      ).readByCount,
      0,
    );
    await createMongooseConversationParticipantRepository().create({
      organizationId: organization.id,
      conversationId: conversation.id,
      userId: memberId,
      addedByUserId: ownerId,
    });
    assert.deepEqual(
      await readerAudiences.listParticipantMemberUserIds(
        organization.id,
        conversation.id,
        ownerId,
      ),
      [memberId],
    );
    assert.equal(
      (
        await readStates.summarizeMessageReaders({
          ...input,
          requireParticipant: true,
        })
      ).readByCount,
      1,
    );

    await MembershipModel.deleteOne({
      organizationId: organization.id,
      userId: memberId,
    }).exec();
    assert.equal(
      (await readStates.summarizeMessageReaders(input)).readByCount,
      0,
    );
    assert.deepEqual(
      await readerAudiences.listParticipantMemberUserIds(
        organization.id,
        conversation.id,
        ownerId,
      ),
      [],
    );
  });

  test("rolls back a private channel when owner participation fails", async () => {
    const base = await createOrganizationAndCategory();
    const failingUnitOfWork: OrganizationUnitOfWork = {
      run: (work) =>
        mongoose.connection.transaction((session) => {
          const participantRepository =
            createMongooseConversationParticipantRepository(session);
          return work({
            categories: createMongooseCategoryRepository(session),
            chatWallpapers: createMongooseChatWallpaperRepository(session),
            conversations: createMongooseConversationRepository(session),
            conversationParticipants: {
              ...participantRepository,
              create: async () => {
                throw new Error("forced participant failure");
              },
            },
            invitations: createMongooseInvitationRepository(session),
            memberships: createMembershipService(
              createMongooseMembershipRepository(session),
            ),
            messages: createMongooseMessageRepository(session),
            messageReactions: createMongooseMessageReactionRepository(session),
            notifications: createMongooseNotificationRepository(session),
            mailOutbox: createMongooseMailOutboxRepository(session),
            conversationReadStates:
              createMongooseConversationReadStateRepository(session),
            organizations: createMongooseOrganizationRepository(session),
            assets: createMongooseStoredAssetRepository(session),
          });
        }),
    };
    const service = createHarness(failingUnitOfWork).conversationService;
    await assert.rejects(
      service.create(ownerId, base.organization.id, {
        categoryId: base.category.id,
        name: "Rollback",
        visibility: ConversationVisibility.PRIVATE,
      }),
      /forced participant failure/,
    );
    assert.equal(await ConversationModel.countDocuments(), 0);
  });

  test("resets participants across visibility transitions", async () => {
    const { category, conversationService, memberships, organization } =
      await createOrganizationAndCategory();
    await memberships.createMember(memberId, organization.id);
    const conversation = await conversationService.create(
      ownerId,
      organization.id,
      {
        categoryId: category.id,
        name: "Leadership",
        visibility: ConversationVisibility.PRIVATE,
      },
    );
    await conversationService.addParticipant(
      ownerId,
      conversation.id,
      memberId,
    );
    assert.equal(await ConversationParticipantModel.countDocuments(), 2);
    await conversationService.update(ownerId, conversation.id, {
      visibility: ConversationVisibility.PUBLIC,
    });
    assert.equal(await ConversationParticipantModel.countDocuments(), 0);
    const message = await createMongooseMessageRepository().create({
      conversationId: conversation.id,
      senderId: ownerId,
      content: "public reaction target",
      messageType: MessageType.TEXT,
    });
    await createMongooseMessageReactionRepository().upsert({
      conversationId: conversation.id,
      messageId: message.id,
      userId: memberId,
      emoji: "👍",
    });
    await conversationService.update(ownerId, conversation.id, {
      visibility: ConversationVisibility.PRIVATE,
    });
    const remaining = await ConversationParticipantModel.find({}).lean().exec();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.userId.toString(), ownerId);
    assert.equal(await MessageReactionModel.countDocuments(), 0);
  });

  test("deletes reactions when a message is redacted", async () => {
    const { category, conversationService, messageService, organization } =
      await createOrganizationAndCategory();
    const conversation = await conversationService.create(
      ownerId,
      organization.id,
      {
        categoryId: category.id,
        name: "Reaction Cleanup",
        visibility: ConversationVisibility.PUBLIC,
      },
    );
    const message = await messageService.create(ownerId, conversation.id, {
      content: "temporary reaction target",
    });
    await createMongooseMessageReactionRepository().upsert({
      conversationId: conversation.id,
      messageId: message.id,
      userId: ownerId,
      emoji: "🎉",
    });

    await messageService.delete(ownerId, message.id);

    assert.equal(await MessageReactionModel.countDocuments(), 0);
    const redacted = await MessageModel.findById(message.id).lean().exec();
    assert.equal(redacted?.content, null);
    assert.ok(redacted?.deletedAt);
  });

  test("deletes a removed private participant's reactions", async () => {
    const { category, conversationService, memberships, organization } =
      await createOrganizationAndCategory();
    await memberships.createMember(memberId, organization.id);
    const conversation = await conversationService.create(
      ownerId,
      organization.id,
      {
        categoryId: category.id,
        name: "Private Reactions",
        visibility: ConversationVisibility.PRIVATE,
      },
    );
    await conversationService.addParticipant(
      ownerId,
      conversation.id,
      memberId,
    );
    const message = await createMongooseMessageRepository().create({
      conversationId: conversation.id,
      senderId: ownerId,
      content: "private reaction target",
      messageType: MessageType.TEXT,
    });
    const reactions = createMongooseMessageReactionRepository();
    await reactions.upsert({
      conversationId: conversation.id,
      messageId: message.id,
      userId: ownerId,
      emoji: "🎉",
    });
    await reactions.upsert({
      conversationId: conversation.id,
      messageId: message.id,
      userId: memberId,
      emoji: "👍",
    });

    await conversationService.removeParticipant(
      ownerId,
      conversation.id,
      memberId,
    );

    const remaining = await MessageReactionModel.find({}).lean().exec();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.userId.toString(), ownerId);
  });

  test("rejects nonempty category deletion and cascades channel messages", async () => {
    const { category, categoryService, conversationService, organization } =
      await createOrganizationAndCategory();
    const conversation = await conversationService.create(
      ownerId,
      organization.id,
      {
        categoryId: category.id,
        name: "General",
        visibility: ConversationVisibility.PUBLIC,
      },
    );
    const message = await createMongooseMessageRepository().create({
      conversationId: conversation.id,
      senderId: ownerId,
      content: "hello",
      messageType: MessageType.TEXT,
    });
    await createMongooseMessageReactionRepository().upsert({
      conversationId: conversation.id,
      messageId: message.id,
      userId: ownerId,
      emoji: "👍",
    });
    await createMongooseConversationReadStateRepository().advance({
      organizationId: organization.id,
      conversationId: conversation.id,
      userId: ownerId,
      lastReadMessageId: message.id,
      lastReadAt: new Date(),
    });
    await createMongooseChatWallpaperRepository().upsert({
      userId: ownerId,
      conversationId: conversation.id,
      wallpaperId: ChatWallpaperId.ABSTRACT_AURORA,
      dimming: 30,
    });
    await assert.rejects(
      categoryService.delete(ownerId, organization.id, category.id),
      /Category must be empty/,
    );
    await conversationService.delete(ownerId, conversation.id);
    assert.equal(await MessageModel.countDocuments(), 0);
    assert.equal(await MessageReactionModel.countDocuments(), 0);
    assert.equal(await ConversationReadStateModel.countDocuments(), 0);
    assert.equal(await ChatWallpaperPreferenceModel.countDocuments(), 0);
    await categoryService.delete(ownerId, organization.id, category.id);
    assert.equal(await CategoryModel.countDocuments(), 0);
  });

  test("reorders categories transactionally", async () => {
    const { category, categoryService, organization } =
      await createOrganizationAndCategory();
    const second = await categoryService.create(ownerId, organization.id, {
      name: "Engineering",
    });
    const moved = await categoryService.update(
      ownerId,
      organization.id,
      second.id,
      { position: 0 },
    );
    const categories = await categoryService.list(ownerId, organization.id);
    assert.equal(moved.position, 0);
    assert.deepEqual(
      categories.map(({ id, position }) => ({ id, position })),
      [
        { id: second.id, position: 0 },
        { id: category.id, position: 1 },
      ],
    );
  });

  test("deletes communication data with its organization", async () => {
    const { category, conversationService, organization, organizationService } =
      await createOrganizationAndCategory();
    const conversation = await conversationService.create(
      ownerId,
      organization.id,
      {
        categoryId: category.id,
        name: "Private",
        visibility: ConversationVisibility.PRIVATE,
      },
    );
    const message = await createMongooseMessageRepository().create({
      conversationId: conversation.id,
      senderId: ownerId,
      content: "temporary",
      messageType: MessageType.TEXT,
    });
    await createMongooseMessageReactionRepository().upsert({
      conversationId: conversation.id,
      messageId: message.id,
      userId: ownerId,
      emoji: "❤️",
    });

    await createMongooseChatWallpaperRepository().upsert({
      userId: ownerId,
      conversationId: conversation.id,
      wallpaperId: ChatWallpaperId.SCENERY_COAST,
      dimming: 40,
    });

    await organizationService.delete(ownerId, organization.id);

    assert.equal(await OrganizationModel.countDocuments(), 0);
    assert.equal(await CategoryModel.countDocuments(), 0);
    assert.equal(await ConversationModel.countDocuments(), 0);
    assert.equal(await ConversationParticipantModel.countDocuments(), 0);
    assert.equal(await MessageModel.countDocuments(), 0);
    assert.equal(await MessageReactionModel.countDocuments(), 0);
    assert.equal(await ChatWallpaperPreferenceModel.countDocuments(), 0);
  });

  test("backfills legacy channels as text idempotently", async () => {
    const id = new mongoose.Types.ObjectId();
    await ConversationModel.collection.insertOne({
      _id: id,
      organizationId: new mongoose.Types.ObjectId(),
      categoryId: new mongoose.Types.ObjectId(),
      name: "Legacy",
      nameKey: "legacy",
      type: "CHANNEL",
      visibility: "PUBLIC",
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const first = await backfillChannelKinds();
    const second = await backfillChannelKinds();
    const migrated = await ConversationModel.collection.findOne({ _id: id });

    assert.equal(first.modifiedCount, 1);
    assert.equal(second.modifiedCount, 0);
    assert.equal(migrated?.kind, ChannelKind.TEXT);
  });

  test("backfills legacy calls as audio idempotently", async () => {
    const id = new mongoose.Types.ObjectId();
    await CallSessionModel.collection.insertOne({
      _id: id,
      organizationId: new mongoose.Types.ObjectId(),
      conversationId: new mongoose.Types.ObjectId(),
      callerUserId: new mongoose.Types.ObjectId(),
      recipientUserId: new mongoose.Types.ObjectId(),
      providerRoomId: randomUUID(),
      status: "ENDED",
      endReason: "COMPLETED",
      startedAt: new Date(),
      endedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const first = await backfillCallMediaModes();
    const second = await backfillCallMediaModes();
    const migrated = await CallSessionModel.collection.findOne({ _id: id });

    assert.equal(first.modifiedCount, 1);
    assert.equal(second.modifiedCount, 0);
    assert.equal(migrated?.mediaMode, "AUDIO");
  });
});
