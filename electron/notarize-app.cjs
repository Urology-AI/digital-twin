// afterSign hook — notarize the .app and staple the ticket.
//
// electron-builder 25's built-in `notarize: true` logs "notarization
// successful" but does NOT embed (staple) the ticket, so the build fails
// Gatekeeper for anyone offline. We do the whole thing here with `notarytool`
// directly (no library), and `notarize: false` in electron-builder.yml.
//
// Only the .app is stapled — never the .dmg. electron-builder builds the .dmg
// from this stapled .app; separately rewriting the compressed .dmg afterwards
// corrupts the stapled .app inside it.

const { execFileSync } = require("node:child_process");
const { rmSync } = require("node:fs");
const path = require("node:path");

exports.default = async function notarizeApp(context) {
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
  // ditto preserves the code signature; `zip` does not.
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
  // Prove the ticket is really embedded and offline-valid.
  run("codesign", ["--test-requirement==notarized", "--verify", "--verbose=1", appPath]);
  console.log(`  • ${appName}.app notarized + stapled + verified`);
};
