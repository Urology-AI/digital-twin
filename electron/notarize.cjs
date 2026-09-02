// afterSign hook (with mac.notarize: false) — notarize the .app with Apple
// and staple the ticket into the bundle.
//
// electron-builder's built-in notarize only submits, it never staples, so
// the shipped app fails Gatekeeper offline. We do submit + staple here with
// `notarytool` / `stapler` directly. This runs on the GitHub macOS runner;
// `stapler` there reaches Apple's ticket service cleanly (running it behind a
// corporate SSL-inspection proxy fails with "Could not validate ticket" even
// when the notarization itself is Accepted).
//
// Only the .app is stapled — never the .dmg (rewriting the compressed .dmg
// afterwards corrupts the stapled .app inside it).

const { execFileSync } = require("node:child_process");
const { rmSync } = require("node:fs");
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
  const zipPath = path.join(context.appOutDir, `${appName}-notarize.zip`);
  const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });

  console.log(`  • notarizing ${appName}.app`);
  run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath]);
  try {
    run("xcrun", [
      "notarytool", "submit", zipPath,
      "--apple-id", APPLE_ID,
      "--password", APPLE_APP_SPECIFIC_PASSWORD,
      "--team-id", APPLE_TEAM_ID,
      "--wait",
    ]);
  } finally {
    rmSync(zipPath, { force: true });
  }

  run("xcrun", ["stapler", "staple", appPath]);
  run("xcrun", ["stapler", "validate", appPath]);
  run("codesign", ["--test-requirement==notarized", "--verify", "--verbose=1", appPath]);
  console.log(`  • ${appName}.app notarized + stapled + verified`);
};
