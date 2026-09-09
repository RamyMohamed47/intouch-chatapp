import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { uploadsApi } from "@/features/uploads/uploads-api";

export interface LocalUploadFile {
  contentType: string;
  fileName: string;
  size: number;
  uri: string;
}

export const uploadFiles = async (
  input:
    | { purpose: "AVATAR" | "ORGANIZATION_LOGO"; files: [LocalUploadFile] }
    | {
        purpose: "MESSAGE_ATTACHMENT";
        conversationId: string;
        files: LocalUploadFile[];
      },
  onProgress?: (index: number, progress: number) => void,
  signal?: AbortSignal,
) => {
  const descriptors = input.files.map(({ contentType, fileName, size }) => ({
    contentType,
    fileName,
    size,
  }));
  const result = await uploadsApi.create(
    input.purpose === "MESSAGE_ATTACHMENT"
      ? {
          purpose: input.purpose,
          conversationId: input.conversationId,
          files: descriptors,
        }
      : {
          purpose: input.purpose,
          files: [descriptors[0] ?? { contentType: "", fileName: "", size: 0 }],
        },
  );

  const completed: string[] = [];
  try {
    for (let index = 0; index < result.uploadTickets.length; index += 1) {
      if (signal?.aborted) throw new Error("Upload cancelled");
      const ticket = result.uploadTickets[index];
      const file = input.files[index];
      if (!ticket || !file) throw new Error("Upload ticket mismatch");
      const task = FileSystem.createUploadTask(
        ticket.uploadUrl,
        file.uri,
        {
          headers: ticket.headers,
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        },
        ({ totalBytesExpectedToSend, totalBytesSent }) => {
          const progress = totalBytesExpectedToSend
            ? totalBytesSent / totalBytesExpectedToSend
            : 0;
          onProgress?.(index, progress);
        },
      );
      const cancel = () => {
        void task.cancelAsync();
      };
      signal?.addEventListener("abort", cancel, { once: true });
      let response;
      try {
        response = await task.uploadAsync();
      } finally {
        signal?.removeEventListener("abort", cancel);
      }
      if (!response || response.status < 200 || response.status >= 300) {
        throw new Error("Object upload failed");
      }
      const promoted = await uploadsApi.complete(ticket.uploadId);
      completed.push(promoted.uploadId);
    }
    return completed;
  } catch (error) {
    await Promise.allSettled(
      result.uploadTickets
        .filter(({ uploadId }) => !completed.includes(uploadId))
        .map(({ uploadId }) => uploadsApi.cancel(uploadId)),
    );
    throw error;
  }
};

export const prepareSquareImage = async (
  uri: string,
  width: number,
  height: number,
): Promise<LocalUploadFile> => {
  const size = Math.min(width, height);
  const context = ImageManipulator.manipulate(uri);
  context.crop({
    originX: Math.max(0, (width - size) / 2),
    originY: Math.max(0, (height - size) / 2),
    width: size,
    height: size,
  });
  context.resize({ width: 512, height: 512 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.88,
    format: SaveFormat.WEBP,
  });
  const info = await FileSystem.getInfoAsync(saved.uri);
  if (!info.exists || typeof info.size !== "number") {
    throw new Error("Prepared image is unavailable");
  }
  return {
    contentType: "image/webp",
    fileName: "intouch-image.webp",
    size: info.size,
    uri: saved.uri,
  };
};
