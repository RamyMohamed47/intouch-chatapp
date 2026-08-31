import { loadEnvFile, parseObservabilityConfig } from "./config/env.js";

loadEnvFile();

const { initializeObservability, shutdownObservability } =
  await import("./infrastructure/observability/index.js");

try {
  initializeObservability(parseObservabilityConfig(process.env));
  await import("./server.js");
} catch (error) {
  const { captureUnexpectedError } =
    await import("./infrastructure/observability/index.js");
  captureUnexpectedError(error, { phase: "bootstrap" });
  console.error("Fatal API bootstrap error", error);
  await shutdownObservability();
  process.exit(1);
}
