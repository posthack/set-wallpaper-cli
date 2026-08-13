const ESC = "\x1b";
const CLEAR_LINE = `${ESC}[K`;
const SYNC_ON = `${ESC}[?2026h`;
const SYNC_OFF = `${ESC}[?2026l`;

interface SyncProbe {
  supported: boolean;
  leftover: Buffer;
}

// Only call this in raw mode. In cooked mode the terminal echoes the reply onto
// the screen and holds it until Enter, and it later surfaces as a keypress.
// The Primary DA request is stitched on so a terminal that ignores DEC 2026
// still answers something and we skip the timeout.
export function probeSyncOutput(timeoutMs = 100): Promise<SyncProbe> {
  const stdin = process.stdin;
  if (!stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve({ supported: false, leftover: Buffer.alloc(0) });
  }

  return new Promise((resolve) => {
    let buffer = "";
    let done = false;

    const finish = (supported: boolean, consumed: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stdin.off("data", onData);
      // latin1 keeps bytes intact, so whatever the user typed survives.
      resolve({ supported, leftover: Buffer.from(buffer.replace(consumed, ""), "latin1") });
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("latin1");
      const answer = buffer.match(/\x1b\[\?2026;(\d)\$y/);
      if (answer) {
        finish(answer[1] === "1" || answer[1] === "2", answer[0]);
        return;
      }
      const da = buffer.match(/\x1b\[\??[\d;]*c/);
      if (da) finish(false, da[0]);
    };

    const timer = setTimeout(() => finish(false, ""), timeoutMs);
    stdin.on("data", onData);
    process.stdout.write(`${ESC}[?2026$p${ESC}[c`);
  });
}

// Ghostty 1.3.1 corrupts the screen on incremental writes inside a synchronized
// block, and a few dozen rows are cheap, so every frame goes out whole.
export class FrameWriter {
  private previous = "";

  constructor(private readonly synchronized: boolean) {}

  write(lines: string[]): void {
    const body = lines.map((line) => line + CLEAR_LINE).join("\r\n") + `${ESC}[J`;
    if (body === this.previous) return;
    this.previous = body;
    const frame = `${ESC}[H` + body;
    process.stdout.write(this.synchronized ? SYNC_ON + frame + SYNC_OFF : frame);
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
