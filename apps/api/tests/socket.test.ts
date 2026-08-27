import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import http from "node:http";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import { Server } from "socket.io";
import { io as createClient, type Socket } from "socket.io-client";

import createSocketRealtimeGateway from "../src/broadcasting/socketRealtimeGateway.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../src/contracts/socket.js";
import type { AccessTokenManager } from "../src/modules/auth/auth.types.js";
import {
  createInMemoryRateLimitStore,
  createRateLimitService,
} from "../src/modules/abuse-protection/index.js";
import { ConversationNotFoundError } from "../src/modules/conversations/conversation.errors.js";
import type { ConversationRecord } from "../src/modules/conversations/conversation.types.js";
import {
  MessageType,
  type MessageRecord,
} from "../src/modules/message/message.types.js";
import configureSocket from "../src/sockets/socket.js";
import createTypingService from "../src/modules/typing/typing.service.js";
import { PresenceStatus } from "../src/modules/presence/presence.types.js";

const firstConversationId = "507f1f77bcf86cd799439011";
const secondConversationId = "507f1f77bcf86cd799439012";
const revokedDuringJoinConversationId = "507f1f77bcf86cd799439087";
const organizationId = "507f1f77bcf86cd799439090";
const firstUserId = "507f1f77bcf86cd799439099";
const secondUserId = "507f1f77bcf86cd799439098";
const now = new Date("2026-08-03T00:00:00.000Z");
const server = http.createServer();
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server);
const accessTokens: AccessTokenManager = {
  getExpiration: () => Math.floor(Date.now() / 1_000) + 60,
  sign: async () => "good-token",
  verify: async (token) => {
    if (token === "good-token") return { userId: firstUserId };
    if (token === "second-token") return { userId: secondUserId };
    throw new Error("invalid token");
  },
};
const conversation = (id: string): ConversationRecord => ({
  id,
  organizationId,
  categoryId: "507f1f77bcf86cd799439091",
  name: "general",
  type: ConversationType.CHANNEL,
  visibility: ConversationVisibility.PUBLIC,
  position: 0,
  createdAt: now,
  updatedAt: now,
});
const conversations = {
  getAccessible: async (_userId: string, conversationId: string) => {
    if (conversationId === revokedDuringJoinConversationId) {
      raceAuthorizationChecks += 1;
      if (raceAuthorizationChecks === 1) {
        return conversation(conversationId);
      }
      throw new ConversationNotFoundError();
    }
    if (
      conversationId === firstConversationId ||
      conversationId === secondConversationId
    ) {
      return conversation(conversationId);
    }
    throw new ConversationNotFoundError();
  },
};
let raceAuthorizationChecks = 0;
const gateway = createSocketRealtimeGateway();
const typing = createTypingService({ realtime: gateway, timeoutMs: 50 });
const rateLimitStore = createInMemoryRateLimitStore();
const rateLimits = createRateLimitService({ store: rateLimitStore });
let denyConnection = false;
let baseUrl: string;
const clients: Socket[] = [];

before(async () => {
  gateway.setTypingService(typing);
  configureSocket(io, accessTokens, conversations, undefined, {
    connections: {
      admit: async () => ({
        allowed: !denyConnection,
        retryAfterMs: denyConnection ? 2_000 : 0,
      }),
      release: async () => undefined,
    },
    memberships: { assertMember: async () => undefined },
    presence: {
      markOnline: async () => undefined,
      markOffline: async () => undefined,
    },
    rateLimits,
    typing,
  });
  gateway.setSocketServer(io);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  for (const client of clients) client.disconnect();
  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });
  rateLimitStore.close();
});

const connect = (token = "good-token") =>
  new Promise<Socket>((resolve, reject) => {
    const client = createClient(baseUrl, {
      auth: { accessToken: token },
      transports: ["websocket"],
      forceNew: true,
    });
    clients.push(client);
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });

const join = (client: Socket, conversationId: string) =>
  new Promise<{ success: boolean }>((resolve) => {
    client.emit("conversation:join", { conversationId }, resolve);
  });

describe("authenticated conversation sockets", () => {
  test("rejects invalid access tokens", async () => {
    await assert.rejects(
      connect("bad-token"),
      /Invalid or expired access token/,
    );
  });

  test("returns typed connection throttling details", async () => {
    denyConnection = true;
    const client = createClient(baseUrl, {
      auth: { accessToken: "good-token" },
      transports: ["websocket"],
      forceNew: true,
    });
    clients.push(client);
    try {
      const error = await new Promise<Error & { data?: unknown }>((resolve) => {
        client.once("connect_error", resolve);
      });
      assert.equal(error.message, "Too many realtime connection attempts");
      assert.deepEqual(error.data, {
        code: "TOO_MANY_REQUESTS",
        message: "Too many realtime connection attempts",
        retryAfterMs: 2_000,
      });
    } finally {
      denyConnection = false;
      client.disconnect();
    }
  });

  test("authorizes joins and isolates message events by room", async () => {
    const firstClient = await connect();
    const secondClient = await connect();
    assert.deepEqual(await join(firstClient, firstConversationId), {
      success: true,
    });
    assert.deepEqual(await join(secondClient, secondConversationId), {
      success: true,
    });

    let secondClientReceived = false;
    secondClient.on("message:created", () => {
      secondClientReceived = true;
    });
    const received = new Promise<MessageRecord>((resolve) => {
      firstClient.once("message:created", resolve);
    });
    const message: MessageRecord = {
      id: "507f1f77bcf86cd799439020",
      conversationId: firstConversationId,
      senderId: "507f1f77bcf86cd799439099",
      content: "hello",
      messageType: MessageType.TEXT,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    gateway.messageCreated(message);
    assert.deepEqual(await received, {
      ...message,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(secondClientReceived, false);
  });

  test("delivers conversation activity only to targeted user rooms", async () => {
    const targeted = await connect();
    const outside = await connect("second-token");
    let outsideReceived = false;
    outside.on("conversation:activity", () => {
      outsideReceived = true;
    });
    const received = new Promise<unknown>((resolve) => {
      targeted.once("conversation:activity", resolve);
    });
    gateway.conversationActivity([firstUserId], {
      organizationId,
      conversationId: firstConversationId,
      conversationType: ConversationType.DIRECT,
      actorUserId: secondUserId,
      activityId: "3d46f75a-83c4-4ac6-a3cb-24aa830c77e8",
      kind: "MESSAGE_CREATED",
    });
    assert.deepEqual(await received, {
      organizationId,
      conversationId: firstConversationId,
      conversationType: "DIRECT",
      actorUserId: secondUserId,
      activityId: "3d46f75a-83c4-4ac6-a3cb-24aa830c77e8",
      kind: "MESSAGE_CREATED",
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(outsideReceived, false);
  });

  test("isolates anonymous reaction invalidations to the conversation room", async () => {
    const firstClient = await connect();
    const secondClient = await connect();
    await join(firstClient, firstConversationId);
    await join(secondClient, secondConversationId);
    let outsideReceived = false;
    secondClient.on("message-reactions:changed", () => {
      outsideReceived = true;
    });
    const event = {
      activityId: "3d46f75a-83c4-4ac6-a3cb-24aa830c77e8",
      conversationId: firstConversationId,
      messageId: "507f1f77bcf86cd799439020",
    };
    const received = new Promise<unknown>((resolve) => {
      firstClient.once("message-reactions:changed", resolve);
    });
    gateway.messageReactionsChanged(event);
    assert.deepEqual(await received, event);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(outsideReceived, false);
  });

  test("broadcasts anonymous channel receipt invalidations except to the reader", async () => {
    const reader = await connect();
    const sender = await connect("second-token");
    await join(reader, firstConversationId);
    await join(sender, firstConversationId);
    let readerReceived = false;
    reader.on("channel-read-receipts:changed", () => {
      readerReceived = true;
    });
    const received = new Promise<unknown>((resolve) => {
      sender.once("channel-read-receipts:changed", resolve);
    });
    gateway.channelReadReceiptsChanged(firstConversationId, firstUserId);
    assert.deepEqual(await received, { conversationId: firstConversationId });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(readerReceived, false);
  });

  test("returns a standard acknowledgement for inaccessible rooms", async () => {
    const client = await connect();
    const result = await join(client, "507f1f77bcf86cd799439088");
    assert.equal(result.success, false);
  });

  test("leaves a room when access is revoked while joining", async () => {
    raceAuthorizationChecks = 0;
    const client = await connect();
    const result = await join(client, revokedDuringJoinConversationId);
    assert.equal(result.success, false);

    let received = false;
    client.on("message:created", () => {
      received = true;
    });
    gateway.messageCreated({
      id: "507f1f77bcf86cd799439021",
      conversationId: revokedDuringJoinConversationId,
      senderId: secondUserId,
      content: "private",
      messageType: MessageType.TEXT,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(received, false);
  });

  test("scopes organization lifecycle events to organization rooms", async () => {
    const subscribed = await connect();
    const outside = await connect("second-token");
    const subscription = await new Promise<{ success: boolean }>((resolve) => {
      subscribed.emit("organization:subscribe", { organizationId }, resolve);
    });
    assert.equal(subscription.success, true);
    let outsideReceived = false;
    let outsideMembershipReceived = false;
    outside.on("presence:updated", () => {
      outsideReceived = true;
    });
    outside.on("membership:joined", () => {
      outsideMembershipReceived = true;
    });
    const received = new Promise<unknown>((resolve) => {
      subscribed.once("presence:updated", resolve);
    });
    gateway.presenceUpdated([organizationId], {
      userId: secondUserId,
      status: PresenceStatus.ONLINE,
      lastSeenAt: null,
    });
    await received;
    const membershipReceived = new Promise<unknown>((resolve) => {
      subscribed.once("membership:joined", resolve);
    });
    gateway.membershipJoined({ organizationId, userId: secondUserId });
    assert.deepEqual(await membershipReceived, {
      organizationId,
      userId: secondUserId,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(outsideReceived, false);
    assert.equal(outsideMembershipReceived, false);
  });

  test("broadcasts typing heartbeats to late joiners but not the sender", async () => {
    const author = await connect();
    const peer = await connect("second-token");
    await join(author, firstConversationId);
    let authorReceived = false;
    author.on("typing:updated", () => {
      authorReceived = true;
    });

    const initialAcknowledgement = await new Promise<{ success: boolean }>(
      (resolve) => {
        author.emit(
          "typing:start",
          { conversationId: firstConversationId },
          resolve,
        );
      },
    );
    assert.equal(initialAcknowledgement.success, true);

    await join(peer, firstConversationId);
    const received = new Promise<{
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }>((resolve) => peer.once("typing:updated", resolve));
    const acknowledgement = await new Promise<{ success: boolean }>(
      (resolve) => {
        author.emit(
          "typing:start",
          { conversationId: firstConversationId },
          resolve,
        );
      },
    );
    assert.equal(acknowledgement.success, true);
    assert.deepEqual(await received, {
      conversationId: firstConversationId,
      userId: firstUserId,
      isTyping: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(authorReceived, false);
  });

  test("shares subscription limits across a user's sockets but permits cleanup", async () => {
    const first = await connect("second-token");
    const second = await connect("second-token");
    let limited = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const client = attempt % 2 === 0 ? first : second;
      const result = await new Promise<{
        error?: { code: string };
        success: boolean;
      }>((resolve) => {
        client.emit("organization:subscribe", { organizationId }, resolve);
      });
      if (!result.success && result.error?.code === "TOO_MANY_REQUESTS") {
        limited = true;
        break;
      }
    }
    assert.equal(limited, true);

    const cleanup = await new Promise<{ success: boolean }>((resolve) => {
      first.emit("organization:unsubscribe", { organizationId }, resolve);
    });
    assert.deepEqual(cleanup, { success: true });
  });
});
