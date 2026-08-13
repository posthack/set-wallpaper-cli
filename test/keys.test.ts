import { describe, expect, test } from "bun:test";
import { classify, parseKeys } from "../src/keys.ts";

describe("parseKeys", () => {
  test("a burst of arrows is not collapsed into one", () => {
    expect(parseKeys("\x1b[B\x1b[B\x1b[B")).toEqual([
      { type: "down" },
      { type: "down" },
      { type: "down" },
    ]);
  });

  test("terminal replies do not swallow the key behind them", () => {
    expect(parseKeys("\x1b[?2026;2$y\x1b[?62;22;52c\x1b[B")).toEqual([
      { type: "ignore" },
      { type: "ignore" },
      { type: "down" },
    ]);
  });

  test("lone Esc is cancel, not the start of a sequence", () => {
    expect(parseKeys("\x1b")).toEqual([{ type: "escape" }]);
  });

  test("letters and arrows interleave", () => {
    expect(parseKeys("a\x1b[Bb")).toEqual([
      { type: "text", value: "a" },
      { type: "down" },
      { type: "text", value: "b" },
    ]);
  });
});

describe("classify", () => {
  test("Home and End differ between terminals", () => {
    for (const token of ["\x1b[H", "\x1b[1~", "\x1bOH"]) {
      expect(classify(token)).toEqual({ type: "home" });
    }
    expect(classify("\x1b[F")).toEqual({ type: "end" });
  });
});
