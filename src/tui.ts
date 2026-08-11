import { clamp, scrollOffset } from "./list.ts";
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

  let cursor = Math.max(0, pictures.findIndex((p) => p.path === current));
  let offset = 0;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let previewed = current;

  const listHeight = () => Math.max(3, (out.rows || 24) - 6);

  const render = () => {
    const height = listHeight();
    offset = scrollOffset(offset, cursor, pictures.length, height);

    const lines = ["", `  Wallpaper  ${title}`, ""];
    for (const [row, picture] of pictures.slice(offset, offset + height).entries()) {
      const selected = offset + row === cursor;
      const mark = picture.path === current ? "•" : " ";
      lines.push(selected ? ` > ${picture.label} ${mark}` : `   ${picture.label} ${mark}`);
    }
    lines.push("");
    lines.push("  arrows move, Enter applies, Esc cancels");
    out.write(CLEAR + lines.join("\n"));
  };

  const schedulePreview = () => {
    if (previewTimer) clearTimeout(previewTimer);
    const picture = pictures[cursor];
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
        const picture = pictures[cursor];
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
      if (key === `${ESC}[A`) cursor = clamp(cursor - 1, pictures.length - 1);
      else if (key === `${ESC}[B`) cursor = clamp(cursor + 1, pictures.length - 1);
      else return;
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
