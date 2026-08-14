import { describe, expect, test } from "bun:test";
import { classify, parseKeys } from "../src/keys.ts";

describe("parseKeys", () => {
  test("пачка стрелок не схлопывается в одну", () => {
    expect(parseKeys("\x1b[B\x1b[B\x1b[B")).toEqual([
      { type: "down" },
      { type: "down" },
      { type: "down" },
    ]);
  });

  test("ответы терминала не съедают следующее нажатие", () => {
    expect(parseKeys("\x1b[?2026;2$y\x1b[?62;22;52c\x1b[B")).toEqual([
      { type: "ignore" },
      { type: "ignore" },
      { type: "down" },
    ]);
  });

  test("одинокий Esc это отмена, а не начало последовательности", () => {
    expect(parseKeys("\x1b")).toEqual([{ type: "escape" }]);
  });

  test("буквы и стрелки идут вперемешку", () => {
    expect(parseKeys("a\x1b[Bb")).toEqual([
      { type: "text", value: "a" },
      { type: "down" },
      { type: "text", value: "b" },
    ]);
  });
});

describe("classify", () => {
  test("Home и End у терминалов разные", () => {
    for (const token of ["\x1b[H", "\x1b[1~", "\x1bOH"]) {
      expect(classify(token)).toEqual({ type: "home" });
    }
    expect(classify("\x1b[F")).toEqual({ type: "end" });
  });
});
