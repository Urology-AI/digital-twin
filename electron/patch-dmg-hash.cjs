#!/usr/bin/env node
// Rewrite the .dmg entries in latest-mac.yml with the hash/size of the
// STAPLED .dmg.
//
// Why this is a build step and not part of notarize-artifacts.cjs: stapling
// rewrites the .dmg, so the hash electron-builder recorded is stale. The
// afterAllArtifactBuild hook tries to patch it, but electron-builder writes
// latest-mac.yml AFTER that hook runs, so the patch found no file and returned
// silently — v1.0.21 shipped a manifest whose .dmg sha512 and size were 1984
// bytes out of date. Running here, after electron-builder has fully finished,
// is the only point where both the stapled .dmg and the manifest exist.
//
// Nothing consumes the .dmg entry at runtime (macOS auto-update pulls the
// .zip), but a manifest that disagrees with the artifact is useless to anyone
// verifying a .dmg they were sent — so keep it honest, and FAIL rather than
// silently no-op if the entry can't be matched.

const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync, existsSync, statSync, readdirSync } = require("node:fs");
const path = require("node:path");

const outDir = process.argv[2] || "release";
const ymlPath = path.join(outDir, "latest-mac.yml");

if (!existsSync(ymlPath)) {
  console.error(`::error::${ymlPath} not found — cannot patch .dmg hashes`);
  process.exit(1);
}

const dmgs = readdirSync(outDir).filter((f) => f.endsWith(".dmg"));
if (dmgs.length === 0) {
  console.error(`::error::no .dmg in ${outDir}`);
  process.exit(1);
}

let yml = readFileSync(ymlPath, "utf8");
let patched = 0;

for (const name of dmgs) {
  const file = path.join(outDir, name);
  const size = statSync(file).size;
  const sha512 = createHash("sha512").update(readFileSync(file)).digest("base64");

  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`( {2}- url: ${esc}\\n {4}sha512: )[^\\n]*(\\n {4}size: )\\d+`);
  if (!block.test(yml)) {
    console.error(`::error::no entry for ${name} in latest-mac.yml — refusing to ship a stale manifest`);
    process.exit(1);
  }
  yml = yml.replace(block, `$1${sha512}$2${size}`);
  patched++;
  console.log(`  • ${name}: sha512=${sha512.slice(0, 16)}… size=${size}`);
}

writeFileSync(ymlPath, yml);
console.log(`  • patched ${patched} .dmg entr${patched === 1 ? "y" : "ies"} in latest-mac.yml`);
