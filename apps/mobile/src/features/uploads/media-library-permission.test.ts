import * as ImagePicker from "expo-image-picker";
import { PermissionStatus } from "expo-image-picker";
import { Alert } from "react-native";

import { requestMediaLibraryAccess } from "@/features/uploads/media-library-permission";

jest.mock("expo-image-picker", () => ({
  PermissionStatus: {
    DENIED: "denied",
    GRANTED: "granted",
    UNDETERMINED: "undetermined",
  },
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

describe("requestMediaLibraryAccess", () => {
  const getPermissions = jest.mocked(
    ImagePicker.getMediaLibraryPermissionsAsync,
  );
  const requestPermissions = jest.mocked(
    ImagePicker.requestMediaLibraryPermissionsAsync,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not open the picker path after photo permission is denied", async () => {
    getPermissions.mockResolvedValue({
      canAskAgain: true,
      expires: "never",
      granted: false,
      status: PermissionStatus.UNDETERMINED,
    });
    requestPermissions.mockResolvedValue({
      canAskAgain: true,
      expires: "never",
      granted: false,
      status: PermissionStatus.DENIED,
    });

    await expect(requestMediaLibraryAccess()).resolves.toBe(false);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      "Photo access required",
      "Allow photo access to select images for InTouch.",
    );
  });

  it("explains how to recover when permission is permanently blocked", async () => {
    getPermissions.mockResolvedValue({
      canAskAgain: false,
      expires: "never",
      granted: false,
      status: PermissionStatus.DENIED,
    });

    await expect(requestMediaLibraryAccess()).resolves.toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Photo access required",
      "Photo access is blocked. Enable it for InTouch from your device settings.",
    );
  });
});
