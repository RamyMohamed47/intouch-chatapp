import {
  buildEchoHistory,
  describeEchoFailure,
  isRetryableEchoFailure,
  type EchoTurnState,
} from "@/features/ai/echo-turn";

describe("Echo turn state", () => {
  it("offers retry only for transient API and network failures", () => {
    expect(isRetryableEchoFailure({ code: "AI_UNAVAILABLE" })).toBe(true);
    expect(isRetryableEchoFailure({ code: "AI_CONTEXT_UNAVAILABLE" })).toBe(
      true,
    );
    expect(isRetryableEchoFailure({ code: "TOO_MANY_REQUESTS" })).toBe(false);
    expect(isRetryableEchoFailure({ code: "AI_RESPONSE_BLOCKED" })).toBe(false);
    expect(
      describeEchoFailure(
        Object.assign(new Error("Try later"), { code: "AI_UNAVAILABLE" }),
      ),
    ).toEqual({
      code: "AI_UNAVAILABLE",
      message: "Try later",
      retryable: true,
    });
    expect(
      describeEchoFailure(new TypeError("Network request failed")),
    ).toEqual({
      code: "NETWORK_ERROR",
      message: "Network request failed",
      retryable: true,
    });
    expect(describeEchoFailure(new Error("Unexpected parser state"))).toEqual({
      code: "AI_CLIENT_ERROR",
      message: "Unexpected parser state",
      retryable: false,
    });
  });

  it("keeps only completed successful turns in the six-message context", () => {
    const turns: EchoTurnState[] = Array.from({ length: 5 }, (_, index) => ({
      prompt: `Question ${index}`,
      response: `Answer ${index}`,
      pending: false,
      error: null,
    }));
    turns.push({
      prompt: "Failed question",
      response: "",
      pending: false,
      error: "Unavailable",
    });

    expect(buildEchoHistory(turns)).toEqual([
      { role: "user", content: "Question 2" },
      { role: "assistant", content: "Answer 2" },
      { role: "user", content: "Question 3" },
      { role: "assistant", content: "Answer 3" },
      { role: "user", content: "Question 4" },
      { role: "assistant", content: "Answer 4" },
    ]);
  });
});
