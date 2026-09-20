import {
  replaceAudioSourceAndWait,
  sanitizeVoiceNotePlaybackError,
} from "@/features/voice-notes/voice-note-playback";

describe("voice-note playback", () => {
  it("waits for the replacement source to finish loading", async () => {
    let listener:
      | ((status: { error: string | null; isLoaded: boolean }) => void)
      | undefined;
    const remove = jest.fn();
    const player = {
      addListener: jest.fn(
        (
          _event: "playbackStatusUpdate",
          next: (status: { error: string | null; isLoaded: boolean }) => void,
        ) => {
          listener = next;
          return { remove };
        },
      ),
      replace: jest.fn(),
    };

    const loading = replaceAudioSourceAndWait(player, "https://example.test/a");
    expect(player.replace).toHaveBeenCalledWith({
      uri: "https://example.test/a",
    });

    listener?.({ error: null, isLoaded: false });
    listener?.({ error: null, isLoaded: true });
    await expect(loading).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("rejects decoder failures and removes its listener", async () => {
    let listener:
      | ((status: { error: string | null; isLoaded: boolean }) => void)
      | undefined;
    const remove = jest.fn();
    const player = {
      addListener: (
        _event: "playbackStatusUpdate",
        next: (status: { error: string | null; isLoaded: boolean }) => void,
      ) => {
        listener = next;
        return { remove };
      },
      replace: jest.fn(),
    };

    const loading = replaceAudioSourceAndWait(player, "https://example.test/a");
    listener?.({ error: "Unsupported stream", isLoaded: false });

    await expect(loading).rejects.toThrow("Unsupported stream");
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("redacts signed URLs and storage identifiers from diagnostics", () => {
    expect(
      sanitizeVoiceNotePlaybackError(
        "Failed https://storage.test/path/6ab01f70e9618b4af1d3b62e?token=secret for 7f8d198e-b08f-45a3-b251-a6b0fac3200d",
      ),
    ).toBe("Failed [url] for [id]");
  });
});
