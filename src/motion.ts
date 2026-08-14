export function motionAllowed(explicitlyOff: boolean): boolean {
  if (explicitlyOff) return false;
  if (process.env.SET_WALLPAPER_NO_MOTION) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.CI) return false;
  if (process.env.TERM === "dumb" || !process.env.TERM) return false;
  if (!process.stdout.isTTY || !process.stdin.isTTY) return false;
  return !prefersReducedMotion();
}

// Общепринятой переменной NO_MOTION не существует, но macOS уже знает ответ:
// Универсальный доступ -> Уменьшение движения.
function prefersReducedMotion(): boolean {
  try {
    const proc = Bun.spawnSync([
      "defaults",
      "read",
      "com.apple.universalaccess",
      "reduceMotion",
    ]);
    return proc.success && proc.stdout.toString().trim() === "1";
  } catch {
    return false;
  }
}
