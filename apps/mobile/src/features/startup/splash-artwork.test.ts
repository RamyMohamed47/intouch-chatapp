import {
  FADE_DURATION_MS,
  MOTION_DURATION_MS,
  sampleSplashMotion,
} from "./splash-artwork";

describe("Hands Connect choreography", () => {
  it("starts with the original mark and keeps decorative layers invisible", () => {
    const first = sampleSplashMotion(0);
    expect(first.vectorOpacity).toBe(0);
    expect(first.sparkOpacity).toBe(0);
    expect(first.wordmarkOpacity).toBe(0);
  });

  it("settles the hands before the spark bridges the fingertip gap", () => {
    const arrival = sampleSplashMotion(800);
    expect(arrival.amberX).toBeCloseTo(0);
    expect(arrival.blueX).toBe(0);
    expect(arrival.rotation).toBe(0);
    expect(arrival.sparkX).toBe(646);
    expect(arrival.sparkY).toBe(337);
    const destination = sampleSplashMotion(1250);
    expect(destination.sparkX).toBe(599);
    expect(destination.sparkY).toBe(353);
  });

  it("completes the wordmark reveal and retires the spark and rings", () => {
    const end = sampleSplashMotion(MOTION_DURATION_MS);
    expect(end.wordmarkOpacity).toBe(1);
    expect(end.wordmarkY).toBe(0);
    expect(end.sparkOpacity).toBe(0);
    expect(end.blueOpacity).toBe(0);
    expect(end.amberOpacity).toBe(0);
  });
  it("reveals the name during the approach and holds it before the two-second finish", () => {
    const approaching = sampleSplashMotion(600);
    expect(approaching.blueX).toBeGreaterThan(0);
    expect(approaching.wordmarkOpacity).toBeGreaterThan(0);
    expect(sampleSplashMotion(1000).wordmarkOpacity).toBe(1);
    expect(sampleSplashMotion(1000).wordmarkY).toBe(0);
    expect(MOTION_DURATION_MS + FADE_DURATION_MS).toBe(2000);
  });
});
