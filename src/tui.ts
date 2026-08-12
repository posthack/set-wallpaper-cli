import { clamp, filterPictures, scrollOffset, truncate } from "./list.ts";
import type { Picture } from "./scan.ts";

const ESC = "\x1b";
const ALT_SCREEN_ON = `${ESC}[?1049h`;
const ALT_SCREEN_OFF = `${ESC}[?1049l`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR = `${ESC}[2J${ESC}[H`;

// Held arrow keys would otherwise thrash the wallpaper agent.
const PREVIEW_DELAY_MS = 60;

export function pickPicture(
  pictures: Picture[],
  title: string,
  current: string | null,
  preview: (picture: Picture) => void,
): Promise<Picture | null> {
  const out = process.stdout;
  const stdin = process.stdin;

  let query = "";
  let visible = pictures;
  let cursor = Math.max(0, pictures.findIndex((p) => p.path === current));
  let offset = 0;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let previewed = current;

  const listHeight = () => Math.max(3, (out.rows || 24) - 6);
  const width = () => (out.columns || 80) - 6;

  const applyQuery = () => {
    const anchor = visible[cursor]?.path;
    visible = filterPictures(pictures, query);
    const kept = visible.findIndex((p) => p.path === anchor);
    cursor = kept >= 0 ? kept : 0;
    offset = 0;
  };

  const render = () => {
    const height = listHeight();
    offset = scrollOffset(offset, cursor, visible.length, height);

    const lines = ["", `  Wallpaper  ${title}`, ""];
    if (visible.length === 0) {
      lines.push("  no matches");
    } else {
      for (const [row, picture] of visible.slice(offset, offset + height).entries()) {
        const selected = offset + row === cursor;
        const mark = picture.path === current ? "•" : " ";
        const label = truncate(picture.label, width());
        lines.push(selected ? ` > ${label} ${mark}` : `   ${label} ${mark}`);
      }
    }
    lines.push("");
    lines.push(query ? `  search: ${query}` : "  arrows move, Enter applies, Esc cancels, type to search");
    out.write(CLEAR + lines.join("\n"));
  };

  const schedulePreview = () => {
    if (previewTimer) clearTimeout(previewTimer);
    const picture = visible[cursor];
    if (!picture || picture.path === previewed) return;
    previewTimer = setTimeout(() => {
      previewTimer = null;
      previewed = picture.path;
      preview(picture);
    }, PREVIEW_DELAY_MS);
  };

  return new Promise((resolve) => {
    const cleanup = () => {
      if (previewTimer) clearTimeout(previewTimer);
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      out.write(SHOW_CURSOR + ALT_SCREEN_OFF);
    };

    const onData = (chunk: Buffer) => {
      const key = chunk.toString();
      if (key === "\r" || key === "\n") {
        const picture = visible[cursor];
        if (!picture) return;
        if (previewTimer) clearTimeout(previewTimer);
        if (previewed !== picture.path) preview(picture);
        cleanup();
        resolve(picture);
        return;
      }
      if (key === ESC || key === "\x03") {
        cleanup();
        resolve(null);
        return;
      }
      if (key === `${ESC}[A`) cursor = clamp(cursor - 1, visible.length - 1);
      else if (key === `${ESC}[B`) cursor = clamp(cursor + 1, visible.length - 1);
      else if (key === "\x7f") {
        if (!query) return;
        query = query.slice(0, -1);
        applyQuery();
      } else if (key === "\x15") {
        if (!query) return;
        query = "";
        applyQuery();
      } else if (key >= " " && !key.startsWith(ESC)) {
        query += key;
        applyQuery();
      } else return;
      render();
      schedulePreview();
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    out.write(ALT_SCREEN_ON + HIDE_CURSOR);
    render();
  });
}
