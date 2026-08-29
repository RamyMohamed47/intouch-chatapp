import {
  ChatWallpaperId,
  type ChatWallpaperDto,
  type ChatWallpaperIdType,
} from "@intouch/shared/chat-wallpapers";

import { cn } from "@/lib/utils";

export type WallpaperCategory = "Doodles" | "Abstract" | "Scenery";

export interface WallpaperPreset {
  id: ChatWallpaperIdType;
  label: string;
  description: string;
  category: WallpaperCategory | "Plain";
}

export interface SceneryWallpaperAssets {
  portrait: string;
  standard: string;
  wide: string;
  portraitThumbnail: string;
  standardThumbnail: string;
  wideThumbnail: string;
}

export const sceneryWallpaperAssets: Partial<
  Record<ChatWallpaperIdType, SceneryWallpaperAssets>
> = {
  [ChatWallpaperId.SCENERY_COAST]: {
    portrait: "/wallpapers/scenery-coast.webp",
    standard: "/wallpapers/scenery-coast-standard.webp",
    wide: "/wallpapers/scenery-coast-wide.webp",
    portraitThumbnail: "/wallpapers/scenery-coast-thumb.webp",
    standardThumbnail: "/wallpapers/scenery-coast-standard-thumb.webp",
    wideThumbnail: "/wallpapers/scenery-coast-wide-thumb.webp",
  },
  [ChatWallpaperId.SCENERY_MOUNTAINS]: {
    portrait: "/wallpapers/scenery-mountains.webp",
    standard: "/wallpapers/scenery-mountains-standard.webp",
    wide: "/wallpapers/scenery-mountains-wide.webp",
    portraitThumbnail: "/wallpapers/scenery-mountains-thumb.webp",
    standardThumbnail: "/wallpapers/scenery-mountains-standard-thumb.webp",
    wideThumbnail: "/wallpapers/scenery-mountains-wide-thumb.webp",
  },
  [ChatWallpaperId.SCENERY_FOREST]: {
    portrait: "/wallpapers/scenery-forest.webp",
    standard: "/wallpapers/scenery-forest-standard.webp",
    wide: "/wallpapers/scenery-forest-wide.webp",
    portraitThumbnail: "/wallpapers/scenery-forest-thumb.webp",
    standardThumbnail: "/wallpapers/scenery-forest-standard-thumb.webp",
    wideThumbnail: "/wallpapers/scenery-forest-wide-thumb.webp",
  },
  [ChatWallpaperId.SCENERY_CITY_LIGHTS]: {
    portrait: "/wallpapers/scenery-city-lights.webp",
    standard: "/wallpapers/scenery-city-lights-standard.webp",
    wide: "/wallpapers/scenery-city-lights-wide.webp",
    portraitThumbnail: "/wallpapers/scenery-city-lights-thumb.webp",
    standardThumbnail: "/wallpapers/scenery-city-lights-standard-thumb.webp",
    wideThumbnail: "/wallpapers/scenery-city-lights-wide-thumb.webp",
  },
};

export const wallpaperPresets: readonly WallpaperPreset[] = [
  {
    id: ChatWallpaperId.NONE,
    label: "Plain",
    description: "Use the current theme background.",
    category: "Plain",
  },
  {
    id: ChatWallpaperId.INTOUCH_DOODLE,
    label: "InTouch",
    description: "Touch points and conversational lines.",
    category: "Doodles",
  },
  {
    id: ChatWallpaperId.DOODLE_ORBIT,
    label: "Orbit",
    description: "Calm rings and connected points.",
    category: "Doodles",
  },
  {
    id: ChatWallpaperId.DOODLE_CHAT,
    label: "Chat notes",
    description: "A playful field of message shapes.",
    category: "Doodles",
  },
  {
    id: ChatWallpaperId.DOODLE_NIGHT,
    label: "Night signals",
    description: "Low-contrast signals for dark rooms.",
    category: "Doodles",
  },
  {
    id: ChatWallpaperId.ABSTRACT_AURORA,
    label: "Aurora flow",
    description: "Cool luminous color drifting softly.",
    category: "Abstract",
  },
  {
    id: ChatWallpaperId.ABSTRACT_SUNSET,
    label: "Sunset glass",
    description: "Warm orange through layered glass.",
    category: "Abstract",
  },
  {
    id: ChatWallpaperId.ABSTRACT_OCEAN,
    label: "Ocean depth",
    description: "A quiet field of layered blues.",
    category: "Abstract",
  },
  {
    id: ChatWallpaperId.ABSTRACT_PAPER,
    label: "Soft paper",
    description: "Subtle texture with restrained warmth.",
    category: "Abstract",
  },
  {
    id: ChatWallpaperId.SCENERY_COAST,
    label: "Blue-hour coast",
    description: "Still water and a warm horizon.",
    category: "Scenery",
  },
  {
    id: ChatWallpaperId.SCENERY_MOUNTAINS,
    label: "Misty mountains",
    description: "An alpine lake at quiet dawn.",
    category: "Scenery",
  },
  {
    id: ChatWallpaperId.SCENERY_FOREST,
    label: "Forest light",
    description: "Rain-washed trees and gentle mist.",
    category: "Scenery",
  },
  {
    id: ChatWallpaperId.SCENERY_CITY_LIGHTS,
    label: "City reflections",
    description: "Night lights across calm water.",
    category: "Scenery",
  },
] as const;

export function ChatWallpaperSurface({
  wallpaper,
  className,
  preview = false,
}: {
  wallpaper: Pick<ChatWallpaperDto, "wallpaperId" | "dimming">;
  className?: string;
  preview?: boolean;
}) {
  const noWallpaper = wallpaper.wallpaperId === ChatWallpaperId.NONE;
  const scenery = sceneryWallpaperAssets[wallpaper.wallpaperId];
  const sceneryLayers = scenery
    ? [
        {
          variant: "portrait",
          src: preview ? scenery.portraitThumbnail : scenery.portrait,
        },
        {
          variant: "standard",
          src: preview ? scenery.standardThumbnail : scenery.standard,
        },
        {
          variant: "wide",
          src: preview ? scenery.wideThumbnail : scenery.wide,
        },
      ]
    : [];
  return (
    <div
      className={cn(
        "chat-wallpaper-surface pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden="true"
      data-testid="chat-wallpaper-surface"
    >
      {!noWallpaper && scenery && (
        <div
          className="absolute inset-0 bg-background"
          data-testid="chat-wallpaper-scenery"
          data-wallpaper={wallpaper.wallpaperId}
        >
          {sceneryLayers.map((layer) => (
            <div
              key={layer.variant}
              className={cn(
                "chat-wallpaper-scene absolute inset-0",
                `chat-wallpaper-scene-${layer.variant}`,
              )}
              data-testid="chat-wallpaper-scene"
              data-wallpaper-variant={layer.variant}
              style={{ backgroundImage: `url("${layer.src}")` }}
            />
          ))}
        </div>
      )}
      {!noWallpaper && !scenery && (
        <div
          className="chat-wallpaper-art absolute inset-0"
          data-wallpaper={wallpaper.wallpaperId}
          data-preview={preview ? "true" : undefined}
        />
      )}
      {!noWallpaper && wallpaper.dimming > 0 && (
        <div
          className="absolute inset-0 bg-background"
          style={{ opacity: wallpaper.dimming / 100 }}
        />
      )}
    </div>
  );
}
