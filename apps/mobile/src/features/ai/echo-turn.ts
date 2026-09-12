import type { AiHistoryMessage } from "@intouch/shared/ai";

export interface EchoTurnState {
  prompt: string;
  response: string;
  pending: boolean;
  error: string | null;
}

const RETRYABLE_CODES = new Set(["AI_UNAVAILABLE", "AI_CONTEXT_UNAVAILABLE"]);

export const isRetryableEchoFailure = (input: {
  code?: string;
  networkFailure?: boolean;
}) =>
  input.networkFailure === true ||
  (input.code !== undefined && RETRYABLE_CODES.has(input.code));

export const describeEchoFailure = (error: unknown) => {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;
  if (code) {
    return {
      code,
      message:
        error instanceof Error
          ? error.message
          : "Echo is temporarily unavailable",
      retryable: isRetryableEchoFailure({ code }),
    };
  }
  const message =
    error instanceof Error ? error.message : "Echo is temporarily unavailable";
  const networkFailure =
    error instanceof TypeError ||
    /network request|failed to fetch|fetch failed|response stream is unavailable/i.test(
      message,
    );
  return {
    code: networkFailure ? "NETWORK_ERROR" : "AI_CLIENT_ERROR",
    message,
    retryable: networkFailure,
  };
};

export const buildEchoHistory = (
  turns: readonly EchoTurnState[],
): AiHistoryMessage[] =>
  turns
    .filter((turn) => !turn.pending && !turn.error && turn.response)
    .flatMap((turn) => [
      { role: "user" as const, content: turn.prompt },
      { role: "assistant" as const, content: turn.response },
    ])
    .slice(-6);
