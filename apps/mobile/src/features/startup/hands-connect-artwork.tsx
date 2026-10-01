import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  SvgXml,
  Text,
  TSpan,
} from "react-native-svg";

import { AMBER_HAND, BLUE_HAND, sampleSplashMotion } from "./splash-artwork";

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
  const revealProps = useAnimatedProps(() => ({ r: frame.value.revealRadius }));
  const wordmarkProps = useAnimatedProps(() => ({
    opacity: frame.value.wordmarkOpacity,
    matrix: [1, 0, 0, 1, 0, frame.value.wordmarkY],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, vectorStyle]}>
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
      <View style={styles.wordmark}>
        <Svg width="100%" height={54} viewBox="0 0 240 54">
          <Defs>
            <ClipPath id="splash-word-reveal">
              <AnimatedCircle animatedProps={revealProps} cx={120} cy={0} />
            </ClipPath>
          </Defs>
          <AnimatedGroup
            animatedProps={wordmarkProps}
            clipPath="url(#splash-word-reveal)"
          >
            <Text
              x={120}
              y={39}
              textAnchor="middle"
              fontFamily="sans-serif"
              fontWeight="900"
              fontSize={31}
              letterSpacing={-1.2}
            >
              <TSpan fill="#ffad2b">In</TSpan>
              <TSpan fill="#168cff">Touch</TSpan>
            </Text>
          </AnimatedGroup>
        </Svg>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wordmark: {
    position: "absolute",
    top: "100%",
    marginTop: 14,
    left: -10,
    right: -10,
  },
});
