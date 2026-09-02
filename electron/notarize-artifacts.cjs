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
    execFileSync("xcrun", ["stapler", "validate", dmg], { stdio: "inherit" });

    const blockmap = `${dmg}.blockmap`;
    if (existsSync(blockmap)) rmSync(blockmap);

    for (const yml of ["latest-mac.yml", "beta-mac.yml", "alpha-mac.yml"]) {
      patchYml(path.join(context.outDir, yml), name, dmg);
    }
    console.log(`  • ${name} notarized + stapled`);
  }
};
