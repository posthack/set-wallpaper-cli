import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findPictures, isImage } from "../src/scan.ts";

const root = mkdtempSync(join(tmpdir(), "set-wallpaper-"));
mkdirSync(join(root, "games"));
mkdirSync(join(root, ".hidden"));
mkdirSync(join(root, "Photos Library.photoslibrary"));
writeFileSync(join(root, "39.jpg"), "");
writeFileSync(join(root, "1920-3.JPG"), "");
writeFileSync(join(root, "notes.txt"), "");
writeFileSync(join(root, ".secret.png"), "");
writeFileSync(join(root, "games", "gta.heic"), "");
writeFileSync(join(root, ".hidden", "nope.png"), "");
writeFileSync(join(root, "Photos Library.photoslibrary", "thumb.jpg"), "");

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("isImage", () => {
  test("регистр расширения не важен", () => {
    expect(isImage("a.JPG")).toBe(true);
    expect(isImage("notes.txt")).toBe(false);
    expect(isImage(".jpg")).toBe(false);
  });
});

describe("findPictures", () => {
  const labels = findPictures(root).map((p) => p.label);

  test("пропускает скрытое, бандлы фото и не-картинки", () => {
    expect(labels).not.toContain("notes.txt");
    expect(labels).not.toContain(".secret.png");
    expect(labels.some((l) => l.includes(".hidden"))).toBe(false);
    expect(labels.some((l) => l.includes("photoslibrary"))).toBe(false);
  });

  test("сортирует по-человечески: 39 раньше 1920, а не как строки", () => {
    expect(labels).toEqual(["39.jpg", "1920-3.JPG", "games/gta.heic"]);
  });

  test("несуществующая папка не роняет процесс", () => {
    expect(findPictures(join(root, "no-such-thing"))).toEqual([]);
  });
});
