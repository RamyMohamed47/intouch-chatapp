import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareAvatarImage } from "@/lib/uploads/avatar-image";
import { prepareSquareImage } from "@/lib/uploads/square-image";

afterEach(() => vi.unstubAllGlobals());

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

  it("centrally crops images to a metadata-free 512px WebP", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1000, height: 500, close }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(new Blob(["webp"], { type: "image/webp" })),
    );

    const result = await prepareSquareImage(
      new File(["source"], "source.png", { type: "image/png" }),
      "organization.webp",
    );

    expect(result.name).toBe("organization.webp");
    expect(result.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      250,
      0,
      500,
      500,
      0,
      0,
      512,
      512,
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
