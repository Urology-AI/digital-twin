// afterSign hook (with mac.notarize: false) — notarize the .app with Apple
// and staple the ticket into the bundle *before* electron-builder packs it
// into the .zip and .dmg. The stapled .app is what makes offline first-launch
// and offline auto-update work.
//
// electron-builder's built-in notarize only submits, it never staples, so the
// shipped app fails Gatekeeper offline. We submit + staple here with
// `notarytool` / `stapler` directly.
//
// The .dmg gets its own submit + staple in notarize-artifacts.cjs
// (afterAllArtifactBuild) — it can't be done here because the .dmg doesn't
// exist yet at afterSign time.

const { notarizeApp, staple, dumpNotaryLog } = require("./notarize-lib.cjs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function notarize(context) {
  if (context.electronPlatformName !== "darwin") return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log("  • skipping notarization — Apple credentials not in the environment");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`  • notarizing ${appName}.app`);
  const id = notarizeApp(appPath);
  dumpNotaryLog(id);
  staple(appPath);

  // Offline-meaningful checks: these only pass from the embedded ticket.
  execFileSync("xcrun", ["stapler", "validate", appPath], { stdio: "inherit" });
  execFileSync(
    "codesign",
    ["--test-requirement==notarized", "--verify", "--verbose=1", appPath],
    { stdio: "inherit" },
  );
  console.log(`  • ${appName}.app notarized + stapled + verified`);
};
