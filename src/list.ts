import type { Picture } from "./scan.ts";

export function filterPictures(pictures: Picture[], query: string): Picture[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return pictures;
  return pictures.filter((p) => p.label.toLowerCase().includes(needle));
}

export function clamp(value: number, max: number): number {
  if (max < 0) return 0;
  return Math.max(0, Math.min(value, max));
}

// Moves the window just enough to keep the cursor visible instead of
// re-centering the list on every step.
export function scrollOffset(
  previous: number,
  cursor: number,
  total: number,
  height: number,
): number {
  if (total <= height) return 0;
  let offset = previous;
  if (cursor < offset) offset = cursor;
  if (cursor >= offset + height) offset = cursor - height + 1;
  return clamp(offset, total - height);
}

// Width in columns, not in `.length`: an ideograph is one UTF-16 unit and two
// columns, and the list stops lining up. Cut plain text, colour it after.
export function truncate(text: string, width: number): string {
  if (width <= 1) return "";
  if (Bun.stringWidth(text) <= width) return text;

  const limit = width - 1; // room for the ellipsis
  let cut = "";
  for (const char of text) {
    if (Bun.stringWidth(cut + char) > limit) break;
    cut += char;
  }
  return cut + "…";
}
