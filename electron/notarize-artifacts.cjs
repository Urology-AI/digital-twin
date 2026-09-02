// afterAllArtifactBuild hook — notarize + staple the final .dmg(s).
//
// The .app inside was already notarized + stapled in notarize.cjs, but a
// downloaded .dmg is itself assessed by Gatekeeper on mount, and on macOS 15+
// an un-notarized disk image trips "Apple could not verify … is free of
// malware" even when the app inside is fine. So the .dmg needs its own ticket.
//
// Stapling rewrites the .dmg, so its sha512/size in latest-mac.yml go stale —
// we recompute and patch them here. (macOS auto-update pulls the .zip, not the
// .dmg, so nothing consumes the .dmg entry at runtime, but keep it honest.)
// The .dmg.blockmap only supports differential .dmg downloads, which
// electron-updater never does on mac; we drop it rather than regenerate it.

const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync, rmSync, existsSync, statSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { submit, staple, dumpNotaryLog } = require("./notarize-lib.cjs");

// `stapler staple` returns before the rewritten .dmg has settled on disk —
// hashing it immediately yields a short read (observed: 1996 bytes short, so
// latest-mac.yml carried a sha512/size for a file that never existed). Wait
// for two identical size readings before hashing.
function waitForStableSize(file, tries = 30) {
  let last = -1;
  for (let i = 0; i < tries; i++) {
    const size = statSync(file).size;
    if (size === last) return size;
    last = size;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(`${path.basename(file)} kept changing size after stapling`);
}

function patchYml(ymlPath, dmgName, dmg) {
  if (!existsSync(ymlPath)) return;
  const sha512 = createHash("sha512").update(readFileSync(dmg)).digest("base64");
  const size = statSync(dmg).size;
  const esc = dmgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`( {2}- url: ${esc}\\n {4}sha512: )[^\\n]*(\\n {4}size: )\\d+`);
  const next = readFileSync(ymlPath, "utf8").replace(block, `$1${sha512}$2${size}`);
  writeFileSync(ymlPath, next);
  console.log(`  • patched ${path.basename(ymlPath)} for ${dmgName} (size ${size})`);
}

exports.default = async function notarizeArtifacts(context) {
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log("  • skipping .dmg notarization — Apple credentials not in the environment");
    return;
  }

  const dmgs = context.artifactPaths.filter((p) => p.endsWith(".dmg"));
  for (const dmg of dmgs) {
    const name = path.basename(dmg);
    console.log(`  • notarizing ${name}`);
    const id = submit(dmg);
    dumpNotaryLog(id);
    staple(dmg);
    waitForStableSize(dmg);
    // Informational only: `stapler validate` reports failure for artifacts
    // Gatekeeper accepts on macOS 15+. The release workflow's verify job gates
    // on `spctl` + `codesign --test-requirement="=notarized"` instead.
    try {
      execFileSync("xcrun", ["stapler", "validate", dmg], { stdio: "inherit" });
    } catch (e) {
      console.log(`  • stapler validate ${name} reported a failure (informational): ${e.message}`);
    }

    const blockmap = `${dmg}.blockmap`;
    if (existsSync(blockmap)) rmSync(blockmap);

    for (const yml of ["latest-mac.yml", "beta-mac.yml", "alpha-mac.yml"]) {
      patchYml(path.join(context.outDir, yml), name, dmg);
    }
    console.log(`  • ${name} notarized + stapled`);
  }
};
