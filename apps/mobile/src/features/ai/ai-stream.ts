import { aiSseEventSchema, type AiSseEvent } from "@intouch/shared/ai";

const parseEvent = (block: string): AiSseEvent | null => {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  return aiSseEventSchema.parse(JSON.parse(data));
};

export const consumeAiSseStream = async (
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: AiSseEvent) => void,
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary = /\r?\n\r?\n/.exec(buffer);
      while (boundary?.index !== undefined) {
        const event = parseEvent(
          buffer.slice(0, boundary.index).replace(/\r\n/g, "\n"),
        );
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (event) onEvent(event);
        boundary = /\r?\n\r?\n/.exec(buffer);
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const event = parseEvent(buffer.replace(/\r\n/g, "\n"));
      if (event) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
};
