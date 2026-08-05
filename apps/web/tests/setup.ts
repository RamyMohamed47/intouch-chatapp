import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./mocks/server";

const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  if (typeof input === "string" && input.startsWith("/")) {
    return nativeFetch(new URL(input, window.location.origin), init);
  }
  return nativeFetch(input, init);
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
