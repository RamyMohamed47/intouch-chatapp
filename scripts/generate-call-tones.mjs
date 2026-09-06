import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const sampleRate = 24_000;
const outputDirectory = fileURLToPath(
  new URL("../apps/web/public/audio/calls/", import.meta.url),
);

const envelope = (elapsed, duration) => {
  const attack = Math.min(1, elapsed / 0.035);
  const release = Math.min(1, (duration - elapsed) / 0.18);
  return Math.max(0, Math.min(attack, release));
};

const renderTone = (durationSeconds, notes) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float64Array(sampleCount);

  for (const note of notes) {
    const start = Math.floor(note.start * sampleRate);
    const end = Math.min(
      sampleCount,
      Math.floor((note.start + note.duration) * sampleRate),
    );
    for (let index = start; index < end; index += 1) {
      const elapsed = index / sampleRate - note.start;
      const phase = 2 * Math.PI * note.frequency * elapsed;
      const shimmer = 0.82 * Math.sin(phase) + 0.18 * Math.sin(phase * 2);
      const movement = 0.94 + 0.06 * Math.sin(2 * Math.PI * 3.2 * elapsed);
      samples[index] +=
        shimmer * movement * envelope(elapsed, note.duration) * note.gain;
    }
  }

  const peak = samples.reduce(
    (maximum, sample) => Math.max(maximum, Math.abs(sample)),
    0,
  );
  const scale = peak > 0 ? 0.78 / peak : 1;
  const pcm = Buffer.alloc(sampleCount * 2);
  samples.forEach((sample, index) => {
    pcm.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, sample * scale)) * 0x7fff),
      index * 2,
    );
  });
  return pcm;
};

const createWave = (pcm) => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

const incomingNotes = [
  { start: 0, duration: 0.52, frequency: 523.25, gain: 0.65 },
  { start: 0, duration: 0.52, frequency: 783.99, gain: 0.28 },
  { start: 0.52, duration: 0.58, frequency: 659.25, gain: 0.66 },
  { start: 0.52, duration: 0.58, frequency: 987.77, gain: 0.26 },
  { start: 1.12, duration: 0.9, frequency: 783.99, gain: 0.62 },
  { start: 1.12, duration: 0.9, frequency: 1046.5, gain: 0.22 },
];

const ringbackNotes = [
  { start: 0, duration: 0.34, frequency: 523.25, gain: 0.55 },
  { start: 0, duration: 0.34, frequency: 659.25, gain: 0.24 },
  { start: 0.46, duration: 0.34, frequency: 523.25, gain: 0.55 },
  { start: 0.46, duration: 0.34, frequency: 659.25, gain: 0.24 },
];

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    path.join(outputDirectory, "intouch-incoming.wav"),
    createWave(renderTone(4.2, incomingNotes)),
  ),
  writeFile(
    path.join(outputDirectory, "intouch-ringback.wav"),
    createWave(renderTone(3.2, ringbackNotes)),
  ),
]);
