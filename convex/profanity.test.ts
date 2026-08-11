import { describe, it, expect } from "vitest";
import { containsProfanity } from "./profanity";

describe("convex/profanity", () => {
  it("flags a blocked word", () => {
    expect(containsProfanity("shit")).toBe(true);
  });

  it("flags a blocked word inside a longer string", () => {
    expect(containsProfanity("what the shit is this")).toBe(true);
  });

  it("catches basic leetspeak substitution", () => {
    expect(containsProfanity("sh1t")).toBe(true);
  });

  it("catches spacing/punctuation evasion", () => {
    expect(containsProfanity("s.h.i.t")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(containsProfanity("SHIT")).toBe(true);
  });

  it("does not flag clean text", () => {
    expect(containsProfanity("hello world, nice drawing!")).toBe(false);
  });

  it("does not flag a normal username", () => {
    expect(containsProfanity("cool_artist_42")).toBe(false);
  });
});
