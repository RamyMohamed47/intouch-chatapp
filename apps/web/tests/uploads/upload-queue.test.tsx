import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUploadQueue } from "@/lib/uploads/use-upload-queue";
import { UploadPurpose } from "@intouch/shared/uploads";

const { cancel, complete, create, putPresignedUpload } = vi.hoisted(() => ({
  cancel: vi.fn(),
  complete: vi.fn(),
  create: vi.fn(),
  putPresignedUpload: vi.fn(),
}));

vi.mock("@/lib/api/uploads", () => ({
  uploadsApi: { cancel, complete, create },
}));

vi.mock("@/lib/uploads/direct-upload", () => ({ putPresignedUpload }));

describe("useUploadQueue", () => {
  beforeEach(() => {
    create.mockResolvedValue({
      uploadTickets: [
        {
          uploadId: "507f1f77bcf86cd799439011",
          uploadUrl: "https://storage.example/upload",
          headers: { "Content-Type": "image/png" },
          expiresAt: "2026-08-30T12:05:00.000Z",
        },
      ],
    });
    complete.mockResolvedValue({
      id: "507f1f77bcf86cd799439011",
      uploadId: "507f1f77bcf86cd799439011",
      fileName: "avatar.png",
      contentType: "image/png",
      size: 4,
      kind: "IMAGE",
      createdAt: "2026-08-30T12:00:00.000Z",
    });
    cancel.mockResolvedValue(undefined);
    putPresignedUpload.mockResolvedValue(undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("enforces the maximum across rapid additions without stale state", async () => {
    const { result } = renderHook(() =>
      useUploadQueue({
        purpose: UploadPurpose.AVATAR,
        maximumFiles: 1,
      }),
    );
    const first = new File(["one"], "avatar.png", { type: "image/png" });
    const second = new File(["two"], "second.png", { type: "image/png" });

    act(() => {
      result.current.addFiles([first]);
      result.current.addFiles([second]);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.file).toBe(first);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });

  it("cancels completed unclaimed uploads when explicitly discarded", async () => {
    const { result } = renderHook(() =>
      useUploadQueue({
        purpose: UploadPurpose.AVATAR,
        maximumFiles: 1,
      }),
    );

    act(() => {
      result.current.addFiles([
        new File(["one"], "avatar.png", { type: "image/png" }),
      ]);
    });
    await waitFor(() =>
      expect(result.current.items[0]?.status).toBe("completed"),
    );

    act(() => result.current.clear({ cancelUploads: true }));

    expect(result.current.items).toHaveLength(0);
    expect(cancel).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
  });
});
