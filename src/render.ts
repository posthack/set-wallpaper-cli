const ESC = "\x1b";
const CLEAR_LINE = `${ESC}[K`;

export class FrameWriter {
  private previous = "";

  write(lines: string[]): void {
    const body = lines.map((line) => line + CLEAR_LINE).join("\r\n") + `${ESC}[J`;
    if (body === this.previous) return;
    this.previous = body;
    const frame = `${ESC}[H` + body;
    process.stdout.write(frame);
  }

  invalidate(): void {
    this.previous = "";
  }
}

export class AnimationLoop {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly step: () => boolean,
    private readonly fps = 60,
  ) {}

  // setInterval accumulates drift, and spinning frames over a still picture only
  // heats the fan, so the timer times itself and stops once nothing moves.
  start(): void {
    if (this.timer) return;
    const interval = 1000 / this.fps;
    const tick = () => {
      const started = performance.now();
      if (!this.step()) {
        this.timer = null;
        return;
      }
      this.timer = setTimeout(tick, Math.max(0, interval - (performance.now() - started)));
    };
    this.timer = setTimeout(tick, interval);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
