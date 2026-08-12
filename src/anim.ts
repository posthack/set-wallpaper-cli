export interface Spring {
  pp: number;
  pv: number;
  vp: number;
  vv: number;
}

// Closed-form critically damped spring (Ryan Juckett). Solving the transition
// matrix once keeps a step at three multiplications and never blows up the way
// naive Euler does at high frequencies.
export function createSpring(dt: number, omega: number): Spring {
  if (omega < Number.EPSILON) return { pp: 1, pv: 0, vp: 0, vv: 1 };
  const e = Math.exp(-omega * dt);
  const te = dt * e;
  const tew = te * omega;
  return { pp: tew + e, pv: te, vp: -omega * tew, vv: e - tew };
}

export function stepSpring(
  spring: Spring,
  position: number,
  velocity: number,
  target: number,
): [number, number] {
  const delta = position - target;
  return [
    delta * spring.pp + velocity * spring.pv + target,
    delta * spring.vp + velocity * spring.vv,
  ];
}

// Block glyphs split a row into eight, so anything finer is invisible and the
// spring can stop there instead of burning frames on the decay tail.
export const SUBCELL_STEPS = 8;

export function isSettled(position: number, velocity: number, target: number): boolean {
  return Math.abs(position - target) < 1 / (SUBCELL_STEPS * 4) && Math.abs(velocity) < 0.05;
}

export type Rgb = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function srgbToOklab([r, g, b]: Rgb): Rgb {
  const R = toLinear(r / 255);
  const G = toLinear(g / 255);
  const B = toLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToSrgb([L, A, B]: Rgb): Rgb {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const clip = (v: number) => Math.max(0, Math.min(255, Math.round(toGamma(v) * 255)));
  return [
    clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

// Blending sRGB bytes directly drops the middle of a transition into muddy grey
// and moves unevenly in brightness, so fades run through OKLab instead.
export function mix(from: Rgb, to: Rgb, t: number): Rgb {
  const k = clamp01(t);
  const a = srgbToOklab(from);
  const b = srgbToOklab(to);
  return oklabToSrgb([
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ]);
}

// Two cube roots per cell per frame add up, and the eye cannot tell more than a
// few dozen steps apart anyway.
export function ramp(from: Rgb, to: Rgb, steps = 48): string[] {
  return Array.from({ length: steps }, (_, i) => fg(mix(from, to, i / (steps - 1))));
}

export function rampAt(steps: string[], t: number): string {
  return steps[Math.round(clamp01(t) * (steps.length - 1))]!;
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function hexToRgb(hex: string): Rgb {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export const fg = ([r, g, b]: Rgb) => `\x1b[38;2;${r};${g};${b}m`;
