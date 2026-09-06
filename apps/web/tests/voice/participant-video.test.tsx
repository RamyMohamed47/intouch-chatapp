import { render, screen } from "@testing-library/react";
import type { LocalVideoTrack } from "livekit-client";
import { describe, expect, it, vi } from "vitest";

import { ParticipantVideo } from "@/components/voice/participant-video";

describe("ParticipantVideo", () => {
  it("attaches the camera track and detaches it when removed", () => {
    const attach = vi.fn();
    const detach = vi.fn();
    const track = { attach, detach } as unknown as LocalVideoTrack;

    const { unmount } = render(
      <ParticipantVideo displayName="Ramy" isLocal track={track} />,
    );

    const video = screen.getByLabelText("Ramy's camera");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveClass("-scale-x-100");
    expect(attach).toHaveBeenCalledWith(video);

    unmount();

    expect(detach).toHaveBeenCalledWith(video);
  });

  it("renders shared screens without cropping or mirroring", () => {
    const track = {
      attach: vi.fn(),
      detach: vi.fn(),
    } as unknown as LocalVideoTrack;

    render(
      <ParticipantVideo
        displayName="Ramy"
        isLocal
        mediaKind="screen"
        track={track}
      />,
    );

    expect(screen.getByLabelText("Ramy's screen")).toHaveClass(
      "object-contain",
    );
    expect(screen.getByLabelText("Ramy's screen")).not.toHaveClass(
      "-scale-x-100",
    );
  });
});
