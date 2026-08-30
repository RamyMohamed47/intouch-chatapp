import { describe, expect, it } from "vitest";

import { prepareAvatarImage } from "@/lib/uploads/avatar-image";

describe("prepareAvatarImage", () => {
  it("rejects browser-decodable formats outside the avatar allowlist", async () => {
    await expect(
      prepareAvatarImage(
        new File(["gif"], "animated.gif", { type: "image/gif" }),
      ),
    ).rejects.toThrow("Choose a JPEG, PNG, or WebP image");
    await expect(
      prepareAvatarImage(
        new File(["<svg/>"], "vector.svg", { type: "image/svg+xml" }),
      ),
    ).rejects.toThrow("Choose a JPEG, PNG, or WebP image");
  });
});
