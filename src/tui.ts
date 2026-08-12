import {
  clamp01,
  createSpring,
  easeOutCubic,
  fg,
  isSettled,
  ramp,
  rampAt,
  stepSpring,
  SUBCELL_STEPS,
} from "./anim.ts";
import { clamp, filterPictures, scrollOffset, truncate } from "./list.ts";
import { AnimationLoop, FrameWriter } from "./render.ts";
import type { Picture } from "./scan.ts";
import { background, palette, RESET } from "./theme.ts";

const ESC = "\x1b";
const ALT_SCREEN_ON = `${ESC}[?1049h`;
const ALT_SCREEN_OFF = `${ESC}[?1049l`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

const CURSOR_OMEGA = 52;
const ENTRANCE_MS = 190;
const ENTRANCE_STAGGER_MS = 16;
const SWEEP_MS = 320;
const SWEEP_SPREAD = 4;
// Held arrow keys would otherwise thrash the wallpaper agent.
const PREVIEW_DELAY_MS = 60;

const EIGHTHS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export interface PickerOptions {
  pictures: Picture[];
  title: string;
  current: string | null;
  preview: (picture: Picture) => void;
  motion: boolean;
}

export interface PickerResult {
  picture: Picture | null;
}

export function pickPicture(options: PickerOptions): Promise<PickerResult> {
  const { pictures, title, current, preview, motion } = options;
  const out = process.stdout;
  const stdin = process.stdin;

  // Raw mode first, then the query: otherwise the reply is echoed onto the
  // screen and comes back as a keypress.
  stdin.setRawMode(true);
  stdin.resume();

  const restoreTerminal = () => {
    try {
      stdin.setRawMode(false);
    } catch {
      // already closed
    }
    out.write(RESET + SHOW_CURSOR + ALT_SCREEN_OFF);
  };
  process.once("exit", restoreTerminal);
  const writer = new FrameWriter();

  const fadeIn = ramp(background, palette.subtle);
  const fadeSelected = ramp(background, palette.text);
  const sweepRamp = ramp(palette.text, palette.iris);
  const cancelRamp = ramp(palette.muted, palette.overlay);

  let query = "";
  let visible = pictures;
  let cursor = Math.max(0, pictures.findIndex((p) => p.path === current));
  let offset = 0;

  // Fractional row inside the viewport: the spring rides between rows.
  let cursorY = 0;
  let cursorVelocity = 0;
  const spring = createSpring(1 / 60, CURSOR_OMEGA);

  let startedAt = performance.now();
  let entranceDone = !motion;
  let phase: "browsing" | "applying" | "cancelling" = "browsing";
  let sweepStartedAt = 0;

  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let previewed = current;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  const listHeight = () => Math.max(3, (out.rows || 24) - 6);
  const width = () => (out.columns || 80) - 6;

  const highlight = (label: string, base: string): string => {
    if (!query.trim()) return base + label;
    const at = label.toLowerCase().indexOf(query.trim().toLowerCase());
    if (at < 0) return base + label;
    const end = at + query.trim().length;
    return (
      base + label.slice(0, at) + fg(palette.gold) + label.slice(at, end) + base + label.slice(end)
    );
  };

  // A cell is indivisible, so the bar moves in block glyphs: the row under the
  // cursor gets its lower part, the next one the upper part drawn by inverting
  // fg and bg. Eight positions per row instead of a jump across a whole one.
  const railFor = (row: number): string => {
    const top = Math.floor(cursorY);
    const fraction = cursorY - top;
    const accent = fg(palette.iris);
    if (row === top) {
      const height = Math.round((1 - fraction) * SUBCELL_STEPS);
      return height === 0 ? " " : accent + EIGHTHS[height]! + RESET;
    }
    if (row === top + 1 && fraction > 0.01) {
      const height = SUBCELL_STEPS - Math.round(fraction * SUBCELL_STEPS);
      const bgAccent = `\x1b[48;2;${palette.iris[0]};${palette.iris[1]};${palette.iris[2]}m`;
      return bgAccent + fg(background) + EIGHTHS[height]! + RESET;
    }
    return " ";
  };

  const render = (now: number): string[] => {
    const height = listHeight();
    const cols = width();
    offset = scrollOffset(offset, cursor, visible.length, height);

    const lines: string[] = [
      "",
      `  ${fg(palette.text)}Wallpaper${RESET}  ${fg(palette.muted)}${title}${RESET}`,
      "",
    ];

    if (visible.length === 0) {
      lines.push(`  ${fg(palette.muted)}no matches${RESET}`);
    } else {
      const slice = visible.slice(offset, offset + height);
      for (const [row, picture] of slice.entries()) {
        const index = offset + row;
        const selected = index === cursor;

        const progress = entranceDone
          ? 1
          : easeOutCubic(clamp01((now - startedAt - row * ENTRANCE_STAGGER_MS) / ENTRANCE_MS));
        const indent = " ".repeat(Math.round((1 - progress) * 3));
        const label = truncate(indent + picture.label, cols);

        let body: string;
        if (phase !== "browsing" && selected) {
          body = sweepLine(label, now);
        } else {
          const steps = selected ? fadeSelected : fadeIn;
          body = highlight(label, rampAt(steps, progress));
        }

        const mark = picture.path === current ? `${fg(palette.muted)}•${RESET}` : " ";
        lines.push(` ${railFor(row)} ${body}${RESET} ${mark}`);
      }
      if (visible.length > height) {
        lines.push(`   ${fg(palette.muted)}${cursor + 1}/${visible.length}${RESET}`);
      }
    }

    lines.push("");
    if (phase === "applying") {
      lines.push(`  ${fg(palette.iris)}✓${RESET} ${fg(palette.muted)}wallpaper set${RESET}`);
    } else if (phase === "cancelling") {
      lines.push(`  ${fg(palette.muted)}↩ restored${RESET}`);
    } else if (query) {
      lines.push(
        `  ${fg(palette.muted)}search:${RESET} ${fg(palette.text)}${query}${fg(palette.iris)}▏${RESET}`,
      );
    } else {
      lines.push(
        `  ${fg(palette.muted)}↑↓ move · Enter apply · Esc cancel · type to search${RESET}`,
      );
    }
    return lines;
  };

  const sweepLine = (label: string, now: number): string => {
    const progress = clamp01((now - sweepStartedAt) / SWEEP_MS);
    const chars = [...label];
    const head = progress * (chars.length + SWEEP_SPREAD * 2) - SWEEP_SPREAD;
    // Cancelling plays the same glint muted and backwards.
    const cancelling = phase === "cancelling";
    const position = cancelling ? chars.length - head : head;
    const steps = cancelling ? cancelRamp : sweepRamp;

    let result = "";
    let previousColor = "";
    for (const [i, char] of chars.entries()) {
      const distance = (i - position) / SWEEP_SPREAD;
      const weight = Math.exp(-(distance * distance));
      const color = rampAt(steps, weight);
      if (color !== previousColor) {
        result += color;
        previousColor = color;
      }
      result += char;
    }
    return result;
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

  const applyQuery = () => {
    const anchor = visible[cursor]?.path;
    visible = filterPictures(pictures, query);
    const kept = visible.findIndex((p) => p.path === anchor);
    cursor = kept >= 0 ? kept : 0;
    offset = 0;
  };

  return new Promise<PickerResult>((resolve) => {
    const loop = new AnimationLoop(() => {
      const now = performance.now();
      const target = cursor - offset;

      let moving = false;
      [cursorY, cursorVelocity] = stepSpring(spring, cursorY, cursorVelocity, target);
      if (isSettled(cursorY, cursorVelocity, target)) {
        cursorY = target;
        cursorVelocity = 0;
      } else {
        moving = true;
      }

      if (!entranceDone) {
        const total = ENTRANCE_MS + listHeight() * ENTRANCE_STAGGER_MS;
        if (now - startedAt >= total) entranceDone = true;
        else moving = true;
      }

      if (phase !== "browsing") {
        if (now - sweepStartedAt >= SWEEP_MS) {
          writer.write(render(now));
          finish(phase === "applying" ? visible[cursor]! : null);
          return false;
        }
        moving = true;
      }

      writer.write(render(now));
      return moving;
    });

    // Any keypress cuts the entrance short.
    const settleEntrance = () => {
      if (entranceDone) return;
      entranceDone = true;
      cursorY = cursor - offset;
      cursorVelocity = 0;
    };

    const draw = () => {
      if (motion) loop.start();
      else writer.write(render(performance.now()));
    };

    const cleanup = () => {
      loop.stop();
      if (previewTimer) clearTimeout(previewTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      stdin.off("data", onData);
      out.off("resize", onResize);
      process.off("exit", restoreTerminal);
      stdin.setRawMode(false);
      stdin.pause();
      out.write(RESET + SHOW_CURSOR + ALT_SCREEN_OFF);
    };

    const finish = (picture: Picture | null) => {
      cleanup();
      resolve({ picture });
    };

    const leave = (kind: "applying" | "cancelling") => {
      const picture = visible[cursor];
      if (kind === "applying") {
        if (!picture) return;
        if (previewTimer) clearTimeout(previewTimer);
        if (previewed !== picture.path) preview(picture);
      }
      if (!motion) {
        finish(kind === "applying" ? picture! : null);
        return;
      }
      settleEntrance();
      phase = kind;
      sweepStartedAt = performance.now();
      loop.start();
    };

    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      // Dragging a window fires dozens of these in a row.
      resizeTimer = setTimeout(() => {
        writer.invalidate();
        out.write(`${ESC}[2J`);
        cursorY = cursor - offset;
        draw();
      }, 40);
    };

    const onData = (chunk: Buffer) => {
      if (phase !== "browsing") return;
      const key = chunk.toString();
      const last = visible.length - 1;

      if (key === "\r" || key === "\n") {
        settleEntrance();
        leave("applying");
        return;
      }
      if (key === ESC || key === "\x03" || key === "\x04") {
        settleEntrance();
        leave("cancelling");
        return;
      }

      settleEntrance();

      if (key === `${ESC}[A`) cursor = clamp(cursor - 1, last);
      else if (key === `${ESC}[B`) cursor = clamp(cursor + 1, last);
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

      draw();
      schedulePreview();
    };

    stdin.on("data", onData);
    out.on("resize", onResize);
    out.write(ALT_SCREEN_ON + HIDE_CURSOR + `${ESC}[2J`);

    startedAt = performance.now();
    cursorY = motion ? Math.max(0, cursor - offset - 1) : cursor - offset;
    draw();
  });
}
