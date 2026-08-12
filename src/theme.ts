import { hexToRgb, type Rgb } from "./anim.ts";

// Rose Pine Moon.
export const palette = {
  overlay: hexToRgb("#393552"),
  muted: hexToRgb("#6e6a86"),
  subtle: hexToRgb("#908caa"),
  text: hexToRgb("#e0def4"),
  gold: hexToRgb("#f6c177"),
  iris: hexToRgb("#c4a7e7"),
} satisfies Record<string, Rgb>;

export const RESET = "\x1b[0m";

// Fades have to run to the terminal background rather than to the palette base,
// otherwise a faded row ends up lighter than the background and reads as
// highlighted. Assumes a dark terminal.
export const background: Rgb = [0, 0, 0];
