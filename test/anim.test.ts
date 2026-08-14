import { describe, expect, test } from "bun:test";
import { createSpring, hexToRgb, isSettled, mix, stepSpring } from "../src/anim.ts";

function settle(omega: number) {
  const spring = createSpring(1 / 60, omega);
  let position = 0;
  let velocity = 0;
  let frames = 0;
  let overshoot = 0;
  while (frames < 600 && !isSettled(position, velocity, 1)) {
    [position, velocity] = stepSpring(spring, position, velocity, 1);
    overshoot = Math.max(overshoot, position - 1);
    frames++;
  }
  return { frames, overshoot, ms: (frames * 1000) / 60 };
}

describe("пружина", () => {
  test("встаёт на цель без перелёта", () => {
    const { overshoot, frames } = settle(52);
    expect(overshoot).toBeLessThan(1e-9);
    expect(frames).toBeLessThan(600);
  });

  test("шаг курсора укладывается в порог восприятия 250 мс", () => {
    expect(settle(52).ms).toBeLessThan(250);
  });
});

describe("mix", () => {
  test("края смешивания это сами цвета", () => {
    const a = hexToRgb("#eb6f92");
    const b = hexToRgb("#c4a7e7");
    expect(mix(a, b, 0)).toEqual(a);
    expect(mix(a, b, 1)).toEqual(b);
  });

  test("от чёрного к белому середина перцептивная, а не 128", () => {
    const [r] = mix(hexToRgb("#000000"), hexToRgb("#ffffff"), 0.5);
    expect(r).toBeLessThan(120);
    expect(r).toBeGreaterThan(80);
  });
});
