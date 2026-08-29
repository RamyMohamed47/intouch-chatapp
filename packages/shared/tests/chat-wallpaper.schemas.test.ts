import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ChatWallpaperId,
  ChatWallpaperSource,
  chatWallpaperResponseSchema,
  updateChatWallpaperSchema,
} from "../chat-wallpapers/index.js";

describe("shared chat wallpaper contracts", () => {
  test("accepts a known preset and bounded dimming", () => {
    assert.deepEqual(
      updateChatWallpaperSchema.parse({
        wallpaperId: ChatWallpaperId.SCENERY_COAST,
        dimming: 42,
      }),
      { wallpaperId: ChatWallpaperId.SCENERY_COAST, dimming: 42 },
    );
  });

  test("normalizes the plain background to zero dimming", () => {
    assert.deepEqual(
      updateChatWallpaperSchema.parse({
        wallpaperId: ChatWallpaperId.NONE,
        dimming: 60,
      }),
      { wallpaperId: ChatWallpaperId.NONE, dimming: 0 },
    );
  });

  test("rejects unknown presets, invalid dimming, and extra fields", () => {
    assert.equal(
      updateChatWallpaperSchema.safeParse({
        wallpaperId: "REMOTE_IMAGE",
        dimming: 20,
      }).success,
      false,
    );
    assert.equal(
      updateChatWallpaperSchema.safeParse({
        wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
        dimming: 81,
      }).success,
      false,
    );
    assert.equal(
      updateChatWallpaperSchema.safeParse({
        wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
        dimming: 35,
        imageUrl: "https://example.com/image.png",
      }).success,
      false,
    );
  });

  test("parses strict response envelopes", () => {
    assert.deepEqual(
      chatWallpaperResponseSchema.parse({
        wallpaper: {
          wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
          dimming: 35,
          source: ChatWallpaperSource.DEFAULT,
        },
      }),
      {
        wallpaper: {
          wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
          dimming: 35,
          source: ChatWallpaperSource.DEFAULT,
        },
      },
    );
  });
});
