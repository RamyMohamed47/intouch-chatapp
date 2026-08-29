import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { ChatWallpaperId } from "@intouch/shared/chat-wallpapers";
import { describe, expect, it } from "vitest";

import {
  ChatWallpaperSurface,
  sceneryWallpaperAssets,
} from "@/components/conversations/chat-wallpaper";

const sceneryIds = [
  ChatWallpaperId.SCENERY_COAST,
  ChatWallpaperId.SCENERY_MOUNTAINS,
  ChatWallpaperId.SCENERY_FOREST,
  ChatWallpaperId.SCENERY_CITY_LIGHTS,
] as const;

describe("ChatWallpaperSurface", () => {
  it("defines complete responsive asset sets for every scenery preset", () => {
    for (const wallpaperId of sceneryIds) {
      const assets = sceneryWallpaperAssets[wallpaperId];
      expect(assets).toBeDefined();
      for (const path of Object.values(assets ?? {})) {
        expect(
          existsSync(resolve(process.cwd(), "public", path.slice(1))),
        ).toBe(true);
      }
    }
  });

  it("renders portrait, standard, and wide full-resolution layers", () => {
    render(
      <ChatWallpaperSurface
        wallpaper={{
          wallpaperId: ChatWallpaperId.SCENERY_COAST,
          dimming: 35,
        }}
      />,
    );

    const scenes = screen.getAllByTestId("chat-wallpaper-scene");
    expect(scenes).toHaveLength(3);
    expect(scenes.map((scene) => scene.dataset.wallpaperVariant)).toEqual([
      "portrait",
      "standard",
      "wide",
    ]);
    expect(scenes[0]).toHaveStyle({
      backgroundImage: 'url("/wallpapers/scenery-coast.webp")',
    });
    expect(scenes[1]).toHaveStyle({
      backgroundImage: 'url("/wallpapers/scenery-coast-standard.webp")',
    });
    expect(scenes[2]).toHaveStyle({
      backgroundImage: 'url("/wallpapers/scenery-coast-wide.webp")',
    });
  });

  it("uses ratio-matched thumbnails in picker previews", () => {
    render(
      <ChatWallpaperSurface
        preview
        wallpaper={{
          wallpaperId: ChatWallpaperId.SCENERY_FOREST,
          dimming: 15,
        }}
      />,
    );

    for (const scene of screen.getAllByTestId("chat-wallpaper-scene")) {
      expect(scene.style.backgroundImage).toContain("-thumb.webp");
    }
  });

  it("keeps code-native wallpapers on the existing art renderer", () => {
    render(
      <ChatWallpaperSurface
        wallpaper={{
          wallpaperId: ChatWallpaperId.ABSTRACT_AURORA,
          dimming: 20,
        }}
      />,
    );

    expect(screen.queryByTestId("chat-wallpaper-scenery")).toBeNull();
    expect(
      screen
        .getByTestId("chat-wallpaper-surface")
        .querySelector(".chat-wallpaper-art"),
    ).not.toBeNull();
  });
});
