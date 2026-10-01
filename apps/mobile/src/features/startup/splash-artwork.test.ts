import { sampleSplashMotion } from "./splash-artwork";

describe("Hands Connect choreography", () => {
  it("starts with the original mark and keeps decorative layers invisible", () => {
    const first = sampleSplashMotion(0);
    expect(first.vectorOpacity).toBe(0);
    expect(first.sparkOpacity).toBe(0);
    expect(first.wordmarkOpacity).toBe(0);
  });

  it("settles the hands before the spark bridges the fingertip gap", () => {
    const arrival = sampleSplashMotion(620);
    expect(arrival.amberX).toBeCloseTo(0);
    expect(arrival.blueX).toBe(0);
    expect(arrival.rotation).toBe(0);
    expect(arrival.sparkX).toBe(646);
    expect(arrival.sparkY).toBe(337);
    const destination = sampleSplashMotion(1000);
    expect(destination.sparkX).toBe(599);
    expect(destination.sparkY).toBe(353);
  });

  it("completes the wordmark reveal and retires the spark and rings", () => {
    const end = sampleSplashMotion(1300);
    expect(end.wordmarkOpacity).toBe(1);
    expect(end.wordmarkY).toBe(0);
    expect(end.revealRadius).toBeGreaterThan(130);
    expect(end.sparkOpacity).toBe(0);
    expect(end.blueOpacity).toBe(0);
    expect(end.amberOpacity).toBe(0);
  });
});
