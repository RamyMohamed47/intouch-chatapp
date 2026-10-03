import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, G, SvgXml } from "react-native-svg";

import {
  AMBER_HAND,
  BLUE_HAND,
  MARK_HEIGHT,
  MARK_WIDTH,
  WORDMARK_GAP,
  WORDMARK_HEIGHT,
  sampleSplashMotion,
} from "./splash-artwork";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedGroup = Animated.createAnimatedComponent(G);

export const HandsConnectArtwork = ({
  elapsed,
  width,
}: {
  elapsed: SharedValue<number>;
  width: number;
}) => {
  const frame = useDerivedValue(() => sampleSplashMotion(elapsed.value));
  const scale = width / 1240;
  const height = (width * MARK_HEIGHT) / MARK_WIDTH;
  const vectorStyle = useAnimatedStyle(() => ({
    opacity: frame.value.vectorOpacity,
  }));
  const amberStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: frame.value.amberX * scale },
      { translateY: frame.value.amberY * scale },
      { rotate: `${-frame.value.rotation}deg` },
    ],
  }));
  const blueStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: frame.value.blueX * scale },
      { translateY: frame.value.blueY * scale },
      { rotate: `${frame.value.rotation}deg` },
    ],
  }));
  const sparkProps = useAnimatedProps(() => ({
    opacity: frame.value.sparkOpacity,
    matrix: [1, 0, 0, 1, frame.value.sparkX, frame.value.sparkY],
  }));
  const sparkCoolProps = useAnimatedProps(() => ({
    opacity: 1 - frame.value.sparkWarmth,
  }));
  const sparkWarmProps = useAnimatedProps(() => ({
    opacity: frame.value.sparkWarmth,
  }));
  const blueRingProps = useAnimatedProps(() => ({
    r: frame.value.blueRadius,
    opacity: frame.value.blueOpacity,
  }));
  const amberRingProps = useAnimatedProps(() => ({
    r: frame.value.amberRadius,
    opacity: frame.value.amberOpacity,
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: frame.value.wordmarkOpacity,
    transform: [{ translateY: frame.value.wordmarkY }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.hands, { height }, vectorStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, amberStyle]}>
          <SvgXml xml={AMBER_HAND} width="100%" height="100%" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, blueStyle]}>
          <SvgXml xml={BLUE_HAND} width="100%" height="100%" />
        </Animated.View>
        <Svg width="100%" height="100%" viewBox="0 0 1240 731">
          <AnimatedCircle
            animatedProps={blueRingProps}
            cx={623}
            cy={344}
            fill="#168cff"
            fillOpacity={0.05}
            stroke="#40bfff"
            strokeWidth={3}
          />
          <AnimatedCircle
            animatedProps={amberRingProps}
            cx={623}
            cy={344}
            fill="none"
            stroke="#ffbc50"
            strokeWidth={2.5}
          />
          <AnimatedGroup animatedProps={sparkProps}>
            <AnimatedGroup animatedProps={sparkCoolProps}>
              <Circle fill="#45dfff" r={49} opacity={0.06} />
              <Circle fill="#45dfff" r={30} opacity={0.16} />
              <Circle fill="#45dfff" r={16} opacity={0.55} />
            </AnimatedGroup>
            <AnimatedGroup animatedProps={sparkWarmProps}>
              <Circle fill="#ffcb68" r={49} opacity={0.06} />
              <Circle fill="#ffcb68" r={30} opacity={0.16} />
              <Circle fill="#ffcb68" r={16} opacity={0.55} />
            </AnimatedGroup>
            <Circle r={6} fill="#f6fcff" />
          </AnimatedGroup>
        </Svg>
      </Animated.View>
      <Animated.View
        style={[styles.wordmark, { top: height + WORDMARK_GAP }, wordmarkStyle]}
        testID="startup-splash-wordmark"
      >
        <Text allowFontScaling={false} style={styles.lettering}>
          <Text style={styles.amber}>In</Text>
          <Text style={styles.blue}>Touch</Text>
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  hands: { position: "absolute", top: 0, left: 0, right: 0 },
  wordmark: {
    position: "absolute",
    height: WORDMARK_HEIGHT,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  lettering: {
    fontSize: 31,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  amber: { color: "#ffad2b" },
  blue: { color: "#168cff" },
});
