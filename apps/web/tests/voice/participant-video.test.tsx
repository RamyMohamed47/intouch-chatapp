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
});
