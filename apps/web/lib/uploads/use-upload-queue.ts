"use client";

import { useEffect, useRef, useState } from "react";
import {
  UploadPurpose,
  createUploadSchema,
  type CompletedUploadDto,
  type UploadPurposeValue,
} from "@intouch/shared/uploads";

import { uploadsApi } from "@/lib/api/uploads";
import { putPresignedUpload } from "@/lib/uploads/direct-upload";

export type UploadQueueStatus = "pending" | "uploading" | "completed" | "error";

export interface UploadQueueItem {
  localId: string;
  file: File;
  previewUrl: string | null;
  progress: number;
  status: UploadQueueStatus;
  uploadId: string | null;
  completed: CompletedUploadDto | null;
  error: string | null;
}

const localId = () => crypto.randomUUID();

export function useUploadQueue({
  purpose,
  conversationId,
  maximumFiles,
}: {
  purpose: UploadPurposeValue;
  conversationId?: string;
  maximumFiles: number;
}) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const itemsRef = useRef<UploadQueueItem[]>([]);

  const mutateItems = (
    updater: (current: UploadQueueItem[]) => UploadQueueItem[],
  ) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  };

  const update = (id: string, patch: Partial<UploadQueueItem>) => {
    mutateItems((current) =>
      current.map((item) =>
        item.localId === id ? { ...item, ...patch } : item,
      ),
    );
  };

  const upload = async (item: UploadQueueItem) => {
    const descriptor = {
      fileName: item.file.name,
      contentType: item.file.type,
      size: item.file.size,
    };
    const request =
      purpose === UploadPurpose.AVATAR
        ? { purpose, files: [descriptor] as [typeof descriptor] }
        : {
            purpose,
            conversationId: conversationId ?? "",
            files: [descriptor],
          };
    const parsed = createUploadSchema.safeParse(request);
    if (!parsed.success) {
      update(item.localId, {
        status: "error",
        error: parsed.error.issues[0]?.message ?? "File is not valid",
      });
      return;
    }

    const controller = new AbortController();
    controllers.current.set(item.localId, controller);
    try {
      update(item.localId, { status: "uploading", progress: 0, error: null });
      const response = await uploadsApi.create(parsed.data);
      const ticket = response.uploadTickets[0];
      if (!ticket) throw new Error("Upload ticket was not issued");
      update(item.localId, { uploadId: ticket.uploadId });
      await putPresignedUpload({
        file: item.file,
        uploadUrl: ticket.uploadUrl,
        headers: ticket.headers,
        signal: controller.signal,
        onProgress: (progress) => update(item.localId, { progress }),
      });
      const completed = await uploadsApi.complete(ticket.uploadId);
      update(item.localId, {
        status: "completed",
        progress: 100,
        uploadId: completed.uploadId,
        completed,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      update(item.localId, {
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      controllers.current.delete(item.localId);
    }
  };

  const addFiles = (files: readonly File[]) => {
    const available = Math.max(0, maximumFiles - itemsRef.current.length);
    const additions = files
      .slice(0, available)
      .map<UploadQueueItem>((file) => ({
        localId: localId(),
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
        progress: 0,
        status: "pending",
        uploadId: null,
        completed: null,
        error: null,
      }));
    mutateItems((current) => [...current, ...additions]);
    for (const item of additions) void upload(item);
  };

  const remove = (id: string) => {
    const item = itemsRef.current.find(({ localId: itemId }) => itemId === id);
    controllers.current.get(id)?.abort();
    if (item?.uploadId) {
      void uploadsApi.cancel(item.uploadId).catch(() => undefined);
    }
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    mutateItems((current) =>
      current.filter(({ localId: itemId }) => itemId !== id),
    );
  };

  const retry = (id: string) => {
    const item = itemsRef.current.find(({ localId: itemId }) => itemId === id);
    if (!item) return;

    void (async () => {
      if (item.uploadId) {
        await uploadsApi.cancel(item.uploadId).catch(() => undefined);
      }
      await upload({ ...item, uploadId: null, completed: null });
    })();
  };

  const clear = ({
    cancelUploads = false,
  }: { cancelUploads?: boolean } = {}) => {
    for (const item of items) {
      controllers.current.get(item.localId)?.abort();
      if (cancelUploads && item.uploadId) {
        void uploadsApi.cancel(item.uploadId).catch(() => undefined);
      }
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    controllers.current.clear();
    mutateItems(() => []);
  };

  useEffect(
    () => () => {
      for (const controller of controllers.current.values()) controller.abort();
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  return {
    items,
    addFiles,
    remove,
    retry,
    clear,
    completedUploadIds: items.flatMap((item) =>
      item.completed ? [item.completed.uploadId] : [],
    ),
    isUploading: items.some(
      ({ status }) => status === "pending" || status === "uploading",
    ),
  };
}
