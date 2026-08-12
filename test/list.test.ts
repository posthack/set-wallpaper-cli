import { describe, expect, test } from "bun:test";
import { filterPictures, scrollOffset, truncate } from "../src/list.ts";
import type { Picture } from "../src/scan.ts";

const pictures: Picture[] = [
  { path: "/p/39.jpg", label: "39.jpg" },
  { path: "/p/1920-3.jpg", label: "1920-3.jpg" },
  { path: "/p/games/GTA-6.jpg", label: "games/GTA-6.jpg" },
];

describe("filterPictures", () => {
  test("empty query keeps everything", () => {
    expect(filterPictures(pictures, "  ")).toHaveLength(3);
  });

  test("matches case-insensitively, directories included", () => {
    expect(filterPictures(pictures, "gta")).toEqual([pictures[2]!]);
    expect(filterPictures(pictures, "games/")).toEqual([pictures[2]!]);
    expect(filterPictures(pictures, "zzz")).toEqual([]);
  });
});

describe("scrollOffset", () => {
  test("stays put while the list fits", () => {
    expect(scrollOffset(0, 4, 5, 10)).toBe(0);
  });

  test("follows the cursor by one step and stops at the tail", () => {
    expect(scrollOffset(0, 5, 20, 5)).toBe(1);
    expect(scrollOffset(10, 3, 20, 5)).toBe(3);
    expect(scrollOffset(18, 19, 20, 5)).toBe(15);
  });
});

describe("truncate", () => {
  test("cuts long strings with an ellipsis", () => {
    expect(truncate("39.jpg", 20)).toBe("39.jpg");
    expect(truncate("gta-6-artwork.jpg", 8)).toBe("gta-6-a…");
  });

  test("counts columns, not UTF-16 units", () => {
    expect(truncate("日本語", 6)).toBe("日本語");
    expect(Bun.stringWidth(truncate("日本語", 4))).toBeLessThanOrEqual(4);
  });
});
