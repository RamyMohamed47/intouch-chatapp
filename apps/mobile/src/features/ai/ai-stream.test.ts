import { consumeAiSseStream } from "@/features/ai/ai-stream";

describe("Echo SSE stream parsing", () => {
  it("parses events split across arbitrary chunks and CRLF boundaries", async () => {
    const payload = [
      `data: ${JSON.stringify({ type: "delta", text: "Hello " })}\r\n\r\n`,
      `data: ${JSON.stringify({ type: "delta", text: "world" })}\n\n`,
      `data: ${JSON.stringify({ type: "completed", finishReason: "STOP" })}\n\n`,
    ].join("");
    const bytes = new TextEncoder().encode(payload);
    const boundaries = [3, 17, 41, bytes.length - 2, bytes.length];
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const boundary = boundaries.shift();
        if (boundary === undefined) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(offset, boundary));
        offset = boundary;
      },
    });
    const events: Array<{ type: string; text?: string }> = [];

    await consumeAiSseStream(stream, (event) => events.push(event));

    expect(events).toEqual([
      { type: "delta", text: "Hello " },
      { type: "delta", text: "world" },
      { type: "completed", finishReason: "STOP" },
    ]);
  });
});
