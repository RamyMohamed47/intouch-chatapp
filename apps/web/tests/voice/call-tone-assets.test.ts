// @vitest-environment node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const assets = [
  {
    name: "intouch-incoming.wav",
    sha256: "758db6814ac349223a15b006a40a01eccfd265a3585ebaa40cb2c7e2a053393c",
  },
  {
    name: "intouch-ringback.wav",
    sha256: "efdb2e69a9fa5fe612696f1e1a20815b5afb2de495e37b381ea4c96fbb89399d",
  },
];

describe("call tone assets", () => {
  it("ships deterministic lightweight PCM WAV files", async () => {
    const files = await Promise.all(
      assets.map(({ name }) =>
        readFile(path.join(process.cwd(), "public", "audio", "calls", name)),
      ),
    );

    expect(files.reduce((total, file) => total + file.length, 0)).toBeLessThan(
      500_000,
    );
    files.forEach((file, index) => {
      expect(file.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(file.subarray(8, 12).toString("ascii")).toBe("WAVE");
      expect(file.readUInt16LE(20)).toBe(1);
      expect(file.readUInt16LE(22)).toBe(1);
      expect(file.readUInt32LE(24)).toBe(24_000);
      expect(file.readUInt16LE(34)).toBe(16);
      expect(createHash("sha256").update(file).digest("hex")).toBe(
        assets[index]?.sha256,
      );
    });
  });
});
