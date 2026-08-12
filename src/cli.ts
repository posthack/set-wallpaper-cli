#!/usr/bin/env bun
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { findPictures, isImage, type Picture } from "./scan.ts";
import { pickPicture } from "./tui.ts";
import { getWallpaper, setWallpaper } from "./wallpaper.ts";

const HELP = `
set-wallpaper — pick a desktop wallpaper

  set-wallpaper              list pictures from ~/Pictures
  set-wallpaper <dir>        list pictures from the given directory
  set-wallpaper <file>       set the wallpaper
  set-wallpaper --random     a random picture from the directory
  set-wallpaper --current    print the current wallpaper
  set-wallpaper --help       this help

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

const flags = process.argv.slice(2).filter((a) => a.startsWith("-"));
const positional = process.argv.slice(2).filter((a) => !a.startsWith("-"));

if (flags.includes("--help") || flags.includes("-h")) {
  console.log(HELP);
} else if (flags.includes("--current")) {
  const current = getWallpaper();
  console.log(current ? shortenHome(current) : "no wallpaper set");
} else {
  const target = positional[0] ? expandPath(positional[0]) : defaultDirectory();
  const isDirectory = existsSync(target) && statSync(target).isDirectory();

  if (!isDirectory) {
    if (!existsSync(target)) fail(`not found: ${shortenHome(target)}`);
    if (!isImage(target)) fail(`not a picture: ${shortenHome(target)}`);
    applyAndReport(target);
  } else {
    const pictures = collect(target);
    if (flags.includes("--random") || flags.includes("-r")) {
      applyAndReport(pictures[Math.floor(Math.random() * pictures.length)]!.path);
    } else if (!process.stdin.isTTY) {
      fail("the list needs an interactive terminal — pass a file or --random");
    } else {
      const original = getWallpaper();
      const { picture: chosen } = await pickPicture({
        pictures,
        title: shortenHome(target),
        current: original,
        motion: process.stdout.isTTY === true,
        preview: (picture) => {
          try {
            setWallpaper(picture.path);
          } catch {
            // a broken file in the preview should not take the list down
          }
        },
      });
      if (chosen) {
        applyAndReport(chosen.path);
      } else {
        if (original) setWallpaper(original);
        console.log("Cancelled, wallpaper restored.");
        process.exitCode = 130;
      }
    }
  }
}
