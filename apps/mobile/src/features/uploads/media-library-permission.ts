import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export const requestMediaLibraryAccess = async () => {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;

  const permission = current.canAskAgain
    ? await ImagePicker.requestMediaLibraryPermissionsAsync()
    : current;
  if (permission.granted) return true;

  Alert.alert(
    "Photo access required",
    permission.canAskAgain
      ? "Allow photo access to select images for InTouch."
      : "Photo access is blocked. Enable it for InTouch from your device settings.",
  );
  return false;
};
