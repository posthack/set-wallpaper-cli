#!/usr/bin/env bun
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { motionAllowed } from "./motion.ts";
import { findPictures, isImage, type Picture } from "./scan.ts";
import { pickPicture } from "./tui.ts";
import { getWallpaper, setWallpaper } from "./wallpaper.ts";

const HELP = `
set-wallpaper — pick a desktop wallpaper

  set-wallpaper              list pictures from ~/Pictures
  set-wallpaper <dir>        list pictures from the given directory
  set-wallpaper <file>       set the wallpaper right away, no list
  set-wallpaper --random     a random picture from the directory
  set-wallpaper --current    print the current wallpaper
  set-wallpaper --no-motion  disable animation
  set-wallpaper --help       this help

In the list: arrows move (the wallpaper changes as you go), Enter keeps it,
Esc restores the original, any letters start a search.

Set SET_WALLPAPER_DIR to change the default directory.
`.trim();

function expandPath(input: string): string {
  const expanded = input.startsWith("~") ? homedir() + input.slice(1) : input;
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
}

function defaultDirectory(): string {
  return expandPath(process.env.SET_WALLPAPER_DIR || `${homedir()}/Pictures`);
}

function shortenHome(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function fail(message: string): never {
  console.error(`set-wallpaper: ${message}`);
  process.exit(1);
}

function collect(directory: string): Picture[] {
  if (!existsSync(directory)) fail(`no such directory: ${shortenHome(directory)}`);
  const pictures = findPictures(directory);
  if (pictures.length === 0) fail(`no pictures in ${shortenHome(directory)}`);
  return pictures;
}

function applyAndReport(path: string): void {
  setWallpaper(path);
  console.log(`Wallpaper: ${shortenHome(path)}`);
}

async function main(argv: string[]): Promise<void> {
  const flags = argv.filter((a) => a.startsWith("-"));
  const positional = argv.filter((a) => !a.startsWith("-"));

  if (flags.includes("--help") || flags.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (flags.includes("--current")) {
    const current = getWallpaper();
    console.log(current ? shortenHome(current) : "no wallpaper set");
    return;
  }

  const known = ["--help", "-h", "--current", "--random", "-r", "--no-motion"];
  const unknown = flags.find((f) => !known.includes(f));
  if (unknown) fail(`unknown flag ${unknown} (see --help)`);

  const target = positional[0] ? expandPath(positional[0]) : defaultDirectory();
  const isDirectory = existsSync(target) && statSync(target).isDirectory();

  // An explicit file is set without further questions.
  if (!isDirectory) {
    if (!existsSync(target)) fail(`not found: ${shortenHome(target)}`);
    if (!isImage(target)) fail(`not a picture: ${shortenHome(target)}`);
    applyAndReport(target);
    return;
  }

  const pictures = collect(target);

  if (flags.includes("--random") || flags.includes("-r")) {
    const picked = pictures[Math.floor(Math.random() * pictures.length)]!;
    applyAndReport(picked.path);
    return;
  }

  if (!process.stdin.isTTY) {
    fail("the list needs an interactive terminal — pass a file or --random");
  }

  const original = getWallpaper();
  const { picture: chosen } = await pickPicture({
    pictures,
    title: shortenHome(target),
    current: original,
    motion: motionAllowed(flags.includes("--no-motion")),
    preview: (picture) => {
      try {
        setWallpaper(picture.path);
      } catch {
        // A broken file in the preview must not take the list down.
      }
    },
  });

  if (chosen) {
    applyAndReport(chosen.path);
    return;
  }

  if (original) setWallpaper(original);
  console.log("Cancelled, wallpaper restored.");
  process.exitCode = 130;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
