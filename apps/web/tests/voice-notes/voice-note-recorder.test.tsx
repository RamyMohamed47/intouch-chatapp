import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceNoteRecorder } from "@/components/conversations/voice-note-recorder";
import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  completeUpload: vi.fn(),
  createMessage: vi.fn(),
  createUpload: vi.fn(),
  pause: vi.fn(),
  putUpload: vi.fn(),
  resume: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/lib/api/messages", () => ({
  messagesApi: { create: mocks.createMessage },
}));

vi.mock("@/lib/api/uploads", () => ({
  uploadsApi: {
    cancel: vi.fn(),
    complete: mocks.completeUpload,
    create: mocks.createUpload,
  },
}));

vi.mock("@/lib/uploads/direct-upload", () => ({
  putPresignedUpload: mocks.putUpload,
}));

vi.mock("@/lib/voice-notes/browser-recorder", () => ({
  BrowserVoiceNoteRecorder: class {
    cancel = mocks.cancel;
    pause = mocks.pause;
    resume = mocks.resume;
    start = mocks.start;
    stop = mocks.stop;
  },
}));

describe("VoiceNoteRecorder", () => {
  beforeEach(() => {
    mocks.start.mockImplementation(
      (onProgress: (durationMs: number) => void) => {
        onProgress(6_500);
        return Promise.resolve();
      },
    );
    mocks.stop.mockResolvedValue({
      blob: new Blob(["voice-note"], { type: "audio/webm" }),
      contentType: "audio/webm",
      durationMs: 6_500,
      fileName: "voice-note.webm",
      waveform: Array(64).fill(25),
    });
    mocks.createUpload.mockResolvedValue({
      uploadTickets: [
        {
          uploadId: "64d000000000000000000001",
          uploadUrl: "https://uploads.example.test/voice-note",
          headers: { "Content-Type": "audio/webm" },
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    });
    mocks.putUpload.mockResolvedValue(undefined);
    mocks.completeUpload.mockRejectedValue(
      new ApiError(
        400,
        "VALIDATION_ERROR",
        "Voice note duration must be between 1 second and 5 minutes",
      ),
    );
  });

  it("clears a non-retryable invalid recording and allows a fresh recording", async () => {
    const onError = vi.fn();
    render(
      <VoiceNoteRecorder
        conversationId="64d000000000000000000002"
        disabled={false}
        onBusyChange={vi.fn()}
        onError={onError}
        onSent={vi.fn()}
        visible
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record voice note" }));
    await screen.findByText("0:06");
    fireEvent.click(screen.getByRole("button", { name: "Send voice note" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Record voice note" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Retry voice note" }),
    ).not.toBeInTheDocument();
    expect(onError).toHaveBeenLastCalledWith(
      "The recording could not be verified. Please record it again.",
    );
  });

  it("does not expose a second recorder while the first recording is preparing", async () => {
    let finishPreparing:
      ((value: Awaited<ReturnType<typeof mocks.stop>>) => void) | undefined;
    mocks.stop.mockReturnValueOnce(
      new Promise((resolve) => {
        finishPreparing = resolve;
      }),
    );
    render(
      <VoiceNoteRecorder
        conversationId="64d000000000000000000002"
        disabled={false}
        onBusyChange={vi.fn()}
        onError={vi.fn()}
        onSent={vi.fn()}
        visible
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record voice note" }));
    await screen.findByText("0:06");
    fireEvent.click(screen.getByRole("button", { name: "Send voice note" }));

    expect(await screen.findByText("Preparing...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record voice note" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send voice note" }),
    ).toBeDisabled();

    finishPreparing?.({
      blob: new Blob(["voice-note"], { type: "audio/webm" }),
      contentType: "audio/webm",
      durationMs: 6_500,
      fileName: "voice-note.webm",
      waveform: Array(64).fill(25),
    });
    await screen.findByRole("button", { name: "Record voice note" });
  });
});
