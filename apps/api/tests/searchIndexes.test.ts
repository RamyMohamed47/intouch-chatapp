import assert from "node:assert/strict";
import { describe, test } from "node:test";

import ConversationModel from "../src/modules/conversations/conversation.model.js";
import MessageModel from "../src/modules/message/message.model.js";
import {
  SEARCH_INDEX_DEFINITIONS,
  SEARCH_INDEX_NAMES,
} from "../src/modules/search/search.indexes.js";
import { UserModel } from "../src/modules/user/user.model.js";

const hasTextIndex = (
  indexes: ReturnType<typeof MessageModel.schema.indexes>,
  expectedFields: Record<string, "text">,
) =>
  indexes.some(([fields]) =>
    Object.entries(expectedFields).every(
      ([field, value]) => fields[field] === value,
    ),
  );

describe("search indexes", () => {
  test("defines exactly three versioned Atlas indexes", () => {
    assert.deepEqual(Object.keys(SEARCH_INDEX_DEFINITIONS), [
      "messages",
      "conversations",
      "users",
    ]);
    assert.deepEqual(SEARCH_INDEX_NAMES, {
      messages: "intouch_messages_v1",
      conversations: "intouch_conversations_v1",
      users: "intouch_users_v1",
    });
    assert.deepEqual(
      SEARCH_INDEX_DEFINITIONS.conversations.definition.mappings.fields._id,
      { type: "objectId" },
    );
    assert.deepEqual(
      SEARCH_INDEX_DEFINITIONS.users.definition.mappings.fields._id,
      { type: "objectId" },
    );
  });

  test("defines native text indexes for messages, channels, and users", () => {
    assert.equal(
      hasTextIndex(MessageModel.schema.indexes(), { content: "text" }),
      true,
    );
    assert.equal(
      hasTextIndex(ConversationModel.schema.indexes(), { name: "text" }),
      true,
    );
    assert.equal(
      hasTextIndex(UserModel.schema.indexes(), {
        displayName: "text",
        username: "text",
      }),
      true,
    );
  });
});
