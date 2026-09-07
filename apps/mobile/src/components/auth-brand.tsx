import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import intouchSignature from "../../../web/public/brand/intouch-signature.webp";

export const AuthBrand = () => (
  <View accessibilityLabel="InTouch" accessibilityRole="image">
    <Image contentFit="contain" source={intouchSignature} style={styles.logo} />
  </View>
);

const styles = StyleSheet.create({
  logo: { height: 66, width: 238 },
});
