// Since macOS 14 the wallpaper lives in com.apple.wallpaper/Store/Index.plist
// and the old `System Events` recipe no longer reaches it. NSWorkspace still
// does, and the JXA bridge costs about 70 ms per call.

const AS_ARGS = ["-l", "JavaScript", "-e"];

function osascript(script: string): string {
  const proc = Bun.spawnSync(["osascript", ...AS_ARGS, script]);
  if (!proc.success) {
    const stderr = proc.stderr.toString().trim();
    throw new Error(stderr || `osascript exited with code ${proc.exitCode}`);
  }
  return proc.stdout.toString().trim();
}

export function getWallpaper(): string | null {
  const out = osascript(`
    ObjC.import("AppKit");
    const url = $.NSWorkspace.sharedWorkspace.desktopImageURLForScreen($.NSScreen.mainScreen);
    url.isNil() ? "" : ObjC.unwrap(url.path);
  `);
  return out || null;
}

// TODO: same picture goes to every display, per-screen would be nicer
export function setWallpaper(path: string): void {
  const out = osascript(`
    ObjC.import("AppKit");
    const url = $.NSURL.fileURLWithPath(${JSON.stringify(path)});
    const ws = $.NSWorkspace.sharedWorkspace;
    const screens = $.NSScreen.screens;
    let ok = true;
    for (let i = 0; i < screens.count; i++) {
      if (!ws.setDesktopImageURLForScreenOptionsError(url, screens.objectAtIndex(i), $(), $())) ok = false;
    }
    ok ? "ok" : "fail";
  `);
  if (out !== "ok") throw new Error(`could not set wallpaper: ${path}`);
}
