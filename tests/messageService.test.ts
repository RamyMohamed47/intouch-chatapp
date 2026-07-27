import assert from "node:assert/strict";
import { describe, test } from "node:test";

import createMessageService from "../src/services/messageService.js";

import type {
  CreateMessageInput,
  MessageRecord,
} from "../src/contracts/message.js";
import type { MessageRepository } from "../src/repositories/messageRepository.js";

describe("messageService", () => {
  test("lists messages through the repository", async () => {
    const messages: MessageRecord[] = [
      {
        _id: "message-1",
        name: "Ramy",
        message: "Hello",
      },
    ];
    const repository: MessageRepository = {
      findAll: async () => messages,
      create: async () => {
        throw new Error("not used");
      },
    };
    const service = createMessageService(repository);

    const result = await service.getAllMessages();

    assert.equal(result, messages);
  });

  test("creates messages through the repository", async () => {
    const input: CreateMessageInput = {
      name: "Ramy",
      message: "Hello",
    };
    const created: MessageRecord = {
      _id: "message-1",
      ...input,
    };
    let receivedInput: CreateMessageInput | undefined;
    const repository: MessageRepository = {
      findAll: async () => [],
      create: async (messageData) => {
        receivedInput = messageData;
        return created;
      },
    };
    const service = createMessageService(repository);

    const result = await service.createMessage(input);

    assert.equal(receivedInput, input);
    assert.equal(result, created);
  });
});
