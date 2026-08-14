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

// Затухать надо в фон терминала, а не в base из палитры, иначе погасшая строка
// окажется светлее фона и будет читаться как подсвеченная. Расчёт на тёмный
// терминал.
export const background: Rgb = [0, 0, 0];
