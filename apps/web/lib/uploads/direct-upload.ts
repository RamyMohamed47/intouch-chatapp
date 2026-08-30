export interface DirectUploadOptions {
  file: Blob;
  uploadUrl: string;
  headers: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export const putPresignedUpload = ({
  file,
  uploadUrl,
  headers,
  signal,
  onProgress,
}: DirectUploadOptions) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error("The file could not be uploaded"));
    });
    request.addEventListener("error", () =>
      reject(new Error("The file upload was interrupted")),
    );
    request.addEventListener("abort", () =>
      reject(new DOMException("Upload canceled", "AbortError")),
    );
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
