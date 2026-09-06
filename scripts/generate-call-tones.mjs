import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const sampleRate = 24_000;
const outputDirectory = fileURLToPath(
  new URL("../apps/web/public/audio/calls/", import.meta.url),
);

const smoothStep = (value) => value * value * (3 - 2 * value);

const envelope = (elapsed, duration) => {
  const attack = smoothStep(Math.min(1, elapsed / 0.09));
  const release = smoothStep(Math.min(1, (duration - elapsed) / 0.38));
  const naturalDecay = Math.exp(-elapsed * 0.45);
  return Math.max(0, Math.min(attack, release)) * naturalDecay;
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
      const softBell = 0.97 * Math.sin(phase) + 0.03 * Math.sin(phase * 2);
      samples[index] += softBell * envelope(elapsed, note.duration) * note.gain;
    }
  }

  const peak = samples.reduce(
    (maximum, sample) => Math.max(maximum, Math.abs(sample)),
    0,
  );
  const scale = peak > 0.42 ? 0.42 / peak : 1;
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
  { start: 0.05, duration: 0.72, frequency: 392, gain: 0.28 },
  { start: 0.62, duration: 0.78, frequency: 493.88, gain: 0.25 },
  { start: 1.23, duration: 1.02, frequency: 587.33, gain: 0.23 },
  { start: 2.08, duration: 0.9, frequency: 493.88, gain: 0.2 },
];

const ringbackNotes = [
  { start: 0.08, duration: 0.76, frequency: 392, gain: 0.2 },
  { start: 0.68, duration: 0.88, frequency: 493.88, gain: 0.17 },
];

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    path.join(outputDirectory, "intouch-incoming.wav"),
    createWave(renderTone(5, incomingNotes)),
  ),
  writeFile(
    path.join(outputDirectory, "intouch-ringback.wav"),
    createWave(renderTone(4, ringbackNotes)),
  ),
]);
