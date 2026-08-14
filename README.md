<div align="center">

# set-wallpaper

Pick your macOS wallpaper without leaving the terminal.

[![macOS 14+](https://img.shields.io/badge/macOS-14%2B-000?style=flat-square&logo=apple)](https://www.apple.com/macos/)
[![Bun](https://img.shields.io/badge/Bun-1.1%2B-fbf0df?style=flat-square&logo=bun&logoColor=000)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

</div>

---

https://github.com/user-attachments/assets/f9bf08e0-c20b-4d95-a4da-b98368542769

Arrow keys walk the list and the desktop changes as you go, so you see the
picture instead of guessing from a filename. `Enter` keeps it. `Esc` puts back
whatever was there before you started. Type any letters to filter.

## Install

Needs [Bun](https://bun.sh) and macOS 14 or newer.

```sh
git clone https://github.com/posthack/set-wallpaper-cli
cd set-wallpaper-cli
bun install
bun run link
```

`bun run link` symlinks the entry point into `~/.local/bin`. Edits under `src/`
apply on the next run, there is nothing to rebuild.

## Usage

```sh
set-wallpaper                # list ~/Pictures
set-wallpaper ~/Wallpapers   # list another directory
set-wallpaper shore.jpg      # set one file, no list
set-wallpaper --random       # roll the dice
set-wallpaper --current      # print what is on screen now
set-wallpaper --no-motion    # skip the animation
```

| Key | Does |
| --- | --- |
| `↑` `↓` | move, wallpaper follows |
| `PgUp` `PgDn` `Home` `End` | jump |
| letters | filter by name |
| `Backspace` `Ctrl-U` | trim or clear the filter |
| `Enter` | keep the selection |
| `Esc` `Ctrl-C` | restore and quit |

Scanning goes recursive from `~/Pictures`, or from `SET_WALLPAPER_DIR` if you
set it. Hidden files and `*.photoslibrary` bundles stay out. Formats: jpg, png,
heic, heif, webp, tiff, gif, bmp. Sorting is natural, so `39.jpg` lands before
`1920-3.jpg`.

## Motion

Three effects, all short, all skippable.

The list fades in with a leftward slide and a 16 ms stagger between rows, 190 ms
in total. Hit any key and it snaps to the end.

The cursor rides a critically damped spring at ω=52: 90% of the distance in
90 ms, settled by 230 ms, no overshoot. Its bar on the left moves in eighths of
a row. A character cell will not subdivide, so intermediate positions come from
the block glyphs `▁▂▃▄▅▆▇█`, with the upper half of a cell drawn by inverting
the background. Hold an arrow key down and the cursor trails behind you, which
gives inertia for free.

Applying gets the one long effect: a 320 ms glint across the filename. `Esc`
plays the same glint backwards and muted.

Everything else stays still. Filtering highlights matched letters rather than
animating rows into new places, because reshuffling a list under someone who is
typing is the most annoying thing you can animate.

Motion turns off with `--no-motion`, `SET_WALLPAPER_NO_MOTION`, `NO_COLOR`,
`CI`, `TERM=dumb`, a non-tty stdout, or Reduce Motion in macOS Accessibility.
The frame timer stops as soon as nothing moves.

<details>
<summary><b>Implementation notes</b></summary>

**Setting the wallpaper.** Since macOS 14 the wallpaper lives in
`~/Library/Application Support/com.apple.wallpaper/Store/Index.plist`, and the
`System Events` AppleScript recipe you find in older answers no longer reaches
it. This calls the public `NSWorkspace.setDesktopImageURL(_:for:options:)`
through the JXA bridge instead, at roughly 70 ms per call. Fast enough that the
preview keeps up with the arrow key.

**The lock screen changes too.** macOS 14 ties it to the desktop picture. The
call rewrites `SystemDefault` in the wallpaper store, no separate key for the
lock screen exists, and the public API offers only scaling, clipping and a fill
color. Editing the plist back does work until `WallpaperAgent` restarts and
flushes its in-memory copy over your edit. System Settings behaves the same way.

**Frames.** Each frame goes out whole in a single write wrapped in synchronized
output (DEC 2026), otherwise a 60 fps redraw tears. Support gets queried at
runtime with `CSI ? 2026 $ p`, since `TERM` says `xterm-256color` under Ghostty
and tells you nothing. A Primary DA request rides along: an answer to that one
and silence on the mode means no support, and we stop waiting.

**Color.** Fades interpolate in OKLab. Blending sRGB bytes drops the middle of a
transition into muddy grey and steps unevenly in brightness. Midpoint between
black and white is 128 in sRGB, while your eye puts it near 99.

**Input.** The terminal delivers bytes in chunks, and one chunk can hold a burst
of keypresses or a reply to a query of ours. Comparing a whole chunk against
`"\x1b[A"` loses keys, which is how the first arrow press used to do nothing.

</details>

## Tests

```sh
bun test
```

Covers the pure parts: directory walk, filter, scrolling, truncation by column
width, spring math, color blending, input parsing.

## License

MIT
