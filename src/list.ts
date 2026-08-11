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
