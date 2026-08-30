import { afterEach, describe, expect, it, vi } from "vitest";

import { putPresignedUpload } from "@/lib/uploads/direct-upload";

class FakeXmlHttpRequest extends EventTarget {
  static latest: FakeXmlHttpRequest | null = null;

  readonly upload = new EventTarget();
  readonly headers = new Map<string, string>();
  method = "";
  status = 0;
  url = "";
  body: Blob | null = null;

  constructor() {
    super();
    FakeXmlHttpRequest.latest = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  send(body: Blob) {
    this.body = body;
  }

  abort() {
    this.dispatchEvent(new Event("abort"));
  }
}

const latestRequest = () => {
  const request = FakeXmlHttpRequest.latest;
  if (!request) throw new Error("Expected an XMLHttpRequest");
  return request;
};

describe("putPresignedUpload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeXmlHttpRequest.latest = null;
  });

  it("uploads with required headers and reports progress", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
    const file = new Blob(["hello"], { type: "text/plain" });
    const onProgress = vi.fn();
    const result = putPresignedUpload({
      file,
      uploadUrl: "https://storage.example/upload",
      headers: { "Content-Type": "text/plain", "x-amz-meta-test": "value" },
      onProgress,
    });
    const request = latestRequest();

    const progress = new Event("progress");
    Object.defineProperties(progress, {
      lengthComputable: { value: true },
      loaded: { value: 5 },
      total: { value: 10 },
    });
    request.upload.dispatchEvent(progress);
    request.status = 200;
    request.dispatchEvent(new Event("load"));

    await expect(result).resolves.toBeUndefined();
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("https://storage.example/upload");
    expect(request.body).toBe(file);
    expect(request.headers.get("Content-Type")).toBe("text/plain");
    expect(request.headers.get("x-amz-meta-test")).toBe("value");
    expect(onProgress).toHaveBeenNthCalledWith(1, 50);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it("aborts the underlying request through AbortSignal", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
    const controller = new AbortController();
    const result = putPresignedUpload({
      file: new Blob(["cancel"]),
      uploadUrl: "https://storage.example/upload",
      headers: {},
      signal: controller.signal,
    });

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});
