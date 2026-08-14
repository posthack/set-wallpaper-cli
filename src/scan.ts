import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".heif",
  ".webp",
  ".tif",
  ".tiff",
  ".gif",
  ".bmp",
]);

export interface Picture {
  path: string;
  /** Что видно в списке: путь относительно корня обхода. */
  label: string;
}

export function isImage(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

// Библиотеки фото пропускаем намеренно: тысячам миниатюр внутри бандла в
// списке обоев делать нечего.
export function findPictures(root: string): Picture[] {
  const found: Picture[] = [];

  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // нет прав или папка исчезла по дороге
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".photoslibrary")) continue;
        walk(full);
      } else if (entry.isFile() && isImage(entry.name)) {
        found.push({ path: full, label: relative(root, full) });
      }
    }
  };

  walk(root);
  found.sort((a, b) => collator.compare(a.label, b.label));
  return found;
}
