import {
  ChatWallpaperId,
  type ChatWallpaperDto,
} from "@intouch/shared/chat-wallpapers";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { useState } from "react";

import cityLights from "../../../assets/wallpapers/scenery-city-lights.webp";
import cityLightsStandard from "../../../assets/wallpapers/scenery-city-lights-standard.webp";
import cityLightsWide from "../../../assets/wallpapers/scenery-city-lights-wide.webp";
import coast from "../../../assets/wallpapers/scenery-coast.webp";
import coastStandard from "../../../assets/wallpapers/scenery-coast-standard.webp";
import coastWide from "../../../assets/wallpapers/scenery-coast-wide.webp";
import forest from "../../../assets/wallpapers/scenery-forest.webp";
import forestStandard from "../../../assets/wallpapers/scenery-forest-standard.webp";
import forestWide from "../../../assets/wallpapers/scenery-forest-wide.webp";
import mountains from "../../../assets/wallpapers/scenery-mountains.webp";
import mountainsStandard from "../../../assets/wallpapers/scenery-mountains-standard.webp";
import mountainsWide from "../../../assets/wallpapers/scenery-mountains-wide.webp";
import chatDoodle from "../../../assets/wallpapers/doodle-chat.svg";
import intouchDoodle from "../../../assets/wallpapers/doodle-intouch.svg";
import nightDoodle from "../../../assets/wallpapers/doodle-night.svg";
import orbitDoodle from "../../../assets/wallpapers/doodle-orbit.svg";

const scenery = {
  SCENERY_COAST: [coast, coastStandard, coastWide],
  SCENERY_MOUNTAINS: [mountains, mountainsStandard, mountainsWide],
  SCENERY_FOREST: [forest, forestStandard, forestWide],
  SCENERY_CITY_LIGHTS: [cityLights, cityLightsStandard, cityLightsWide],
} as const;

const doodles = {
  INTOUCH_DOODLE: intouchDoodle,
  DOODLE_ORBIT: orbitDoodle,
  DOODLE_CHAT: chatDoodle,
  DOODLE_NIGHT: nightDoodle,
} as const;

const gradients = {
  ABSTRACT_AURORA: ["#062b32", "#0b5860", "#09202f"],
  ABSTRACT_SUNSET: ["#3b1712", "#9b3f1d", "#26121d"],
  ABSTRACT_OCEAN: ["#061d3a", "#0b4c72", "#071525"],
  ABSTRACT_PAPER: ["#d9cdb7", "#b9aa91", "#efe5d4"],
} as const;

export const ChatWallpaper = ({
  wallpaper,
}: {
  wallpaper?: ChatWallpaperDto | undefined;
}) => {
  const [aspectRatio, setAspectRatio] = useState(0);
  if (!wallpaper || wallpaper.wallpaperId === ChatWallpaperId.NONE) return null;
  const scenerySources = scenery[wallpaper.wallpaperId as keyof typeof scenery];
  const scenerySource =
    scenerySources?.[aspectRatio < 1 ? 0 : aspectRatio < 1.5 ? 1 : 2];
  const doodleSource = doodles[wallpaper.wallpaperId as keyof typeof doodles];
  const colors = gradients[wallpaper.wallpaperId as keyof typeof gradients];

  return (
    <View
      onLayout={({ nativeEvent }) => {
        const { height, width } = nativeEvent.layout;
        if (height > 0) setAspectRatio(width / height);
      }}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      {scenerySource ? (
        <Image
          contentFit="cover"
          source={scenerySource}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {doodleSource ? (
        <Image
          contentFit="cover"
          source={doodleSource}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {colors ? (
        <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(0,0,0,${wallpaper.dimming / 100})` },
        ]}
      />
    </View>
  );
};
