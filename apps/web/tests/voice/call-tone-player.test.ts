import { describe, expect, it, vi } from "vitest";

import {
  CallToneKind,
  createCallTonePlayer,
  type CallToneAudioFactory,
} from "@/lib/voice/call-tone-player";

const createAudioHarness = () => {
  const elements: Array<{
    currentTime: number;
    load: ReturnType<typeof vi.fn>;
    loop: boolean;
    pause: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    preload: string;
    removeAttribute: ReturnType<typeof vi.fn>;
    source: string;
    src: string;
    volume: number;
  }> = [];
  const factory: CallToneAudioFactory = (source) => {
    const element = {
      currentTime: 12,
      load: vi.fn(),
      loop: false,
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      preload: "" as HTMLAudioElement["preload"],
      removeAttribute: vi.fn(),
      source,
      src: "",
      volume: 1,
    };
    elements.push(element);
    return element;
  };
  return { elements, factory };
};

describe("call tone player", () => {
  it("preloads bounded incoming and ringback sounds", () => {
    const { elements, factory } = createAudioHarness();
    createCallTonePlayer(factory);

    expect(elements).toHaveLength(2);
    expect(elements.map(({ source }) => source)).toEqual([
      "/audio/calls/intouch-incoming.wav",
      "/audio/calls/intouch-ringback.wav",
    ]);
    expect(elements.every(({ loop }) => loop)).toBe(true);
    expect(elements.every(({ preload }) => preload === "auto")).toBe(true);
    expect(elements[0]?.volume).toBeGreaterThan(elements[1]?.volume ?? 1);
  });

  it("deduplicates playback, switches tones, and resets on stop", async () => {
    const { elements, factory } = createAudioHarness();
    const player = createCallTonePlayer(factory);

    await player.play(CallToneKind.Incoming);
    await player.play(CallToneKind.Incoming);
    expect(elements[0]?.play).toHaveBeenCalledOnce();

    await player.play(CallToneKind.Ringback);
    expect(elements[0]?.pause).toHaveBeenCalled();
    expect(elements[1]?.play).toHaveBeenCalledOnce();

    player.stop();
    expect(elements.every(({ currentTime }) => currentTime === 0)).toBe(true);
  });

  it("reports autoplay blocking, permits retry, and disposes resources", async () => {
    const { elements, factory } = createAudioHarness();
    const player = createCallTonePlayer(factory);
    const blocked = new Error("User gesture required");
    blocked.name = "NotAllowedError";
    elements[0]?.play.mockRejectedValueOnce(blocked);

    await expect(player.play(CallToneKind.Incoming)).resolves.toBe("BLOCKED");
    await expect(player.play(CallToneKind.Incoming)).resolves.toBe("PLAYING");

    player.dispose();
    expect(
      elements.every(({ removeAttribute }) =>
        removeAttribute.mock.calls.some(([name]) => name === "src"),
      ),
    ).toBe(true);
    expect(elements.every(({ load }) => load.mock.calls.length === 1)).toBe(
      true,
    );
    await expect(player.play(CallToneKind.Incoming)).resolves.toBe("FAILED");
  });
});
