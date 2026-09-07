#!/usr/bin/env node
// Bundles src/offscreen.src.js (which imports @soundtouchjs/audio-worklet)
// into lib/offscreen.bundle.js, and vendors the two other static assets the
// offscreen document loads at runtime. Output is committed to git so
// "load unpacked" works with no build step — only re-run this when bumping
// the pinned dependency versions in package.json.
import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const libDir = path.join(here, "lib");
mkdirSync(libDir, { recursive: true });

await build({
  entryPoints: [path.join(here, "src", "offscreen.src.js")],
  bundle: true,
  format: "iife",
  target: ["chrome116"],
  outfile: path.join(libDir, "offscreen.bundle.js"),
  logLevel: "info",
});

copyFileSync(
  path.join(here, "node_modules", "@soundtouchjs", "audio-worklet", "dist", "soundtouch-processor.js"),
  path.join(libDir, "soundtouch-processor.js")
);

copyFileSync(
  path.join(here, "node_modules", "socket.io-client", "dist", "socket.io.min.js"),
  path.join(libDir, "socket.io.min.js")
);

console.log("Built extension/lib/{offscreen.bundle.js, soundtouch-processor.js, socket.io.min.js}");
