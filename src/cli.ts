#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { getWallpaper, setWallpaper } from "./wallpaper.ts";

const HELP = `
set-wallpaper — pick a desktop wallpaper

  set-wallpaper <file>       set the wallpaper
  set-wallpaper --current    print the current wallpaper
  set-wallpaper --help       this help
`.trim();

function expandPath(input: string): string {
  const expanded = input.startsWith("~") ? homedir() + input.slice(1) : input;
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
}

function shortenHome(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function fail(message: string): never {
  console.error(`set-wallpaper: ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
  console.log(HELP);
} else if (argv.includes("--current")) {
  const current = getWallpaper();
  console.log(current ? shortenHome(current) : "no wallpaper set");
} else {
  const target = expandPath(argv[0]!);
  if (!existsSync(target)) fail(`not found: ${shortenHome(target)}`);
  setWallpaper(target);
  console.log(`Wallpaper: ${shortenHome(target)}`);
}
