// С macOS 14 обои живут в com.apple.wallpaper/Store/Index.plist, и старый
// рецепт через `System Events` до них уже не достаёт. NSWorkspace достаёт,
// а мост JXA стоит около 70 мс на вызов.

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

// TODO: на все экраны уходит одна картинка, по-хорошему нужен свой на каждый
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
