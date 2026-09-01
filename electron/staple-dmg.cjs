// afterAllArtifactBuild hook — notarize the .dmg itself and staple the ticket.
// The .app inside is already notarized + stapled by notarize.cjs, but Gatekeeper
// on a freshly downloaded .dmg validates the .dmg's own ticket, so it needs its
// own submission (you can't just `stapler staple` a .dmg that was never
// submitted — that fails with "Could not find base64 encoded ticket").

const { execFileSync } = require("node:child_process");

exports.default = function notarizeAndStapleDmg(context) {
  if (process.platform !== "darwin") return [];
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log("  • skipping .dmg notarization — Apple credentials not set");
    return [];
  }

  for (const file of context.artifactPaths) {
    if (!file.endsWith(".dmg")) continue;
    console.log(`  • notarizing ${file}`);
    execFileSync(
      "xcrun",
      [
        "notarytool", "submit", file,
        "--apple-id", process.env.APPLE_ID,
        "--password", process.env.APPLE_APP_SPECIFIC_PASSWORD,
        "--team-id", process.env.APPLE_TEAM_ID,
        "--wait",
      ],
      { stdio: "inherit" },
    );
    execFileSync("xcrun", ["stapler", "staple", file], { stdio: "inherit" });
    execFileSync("xcrun", ["stapler", "validate", file], { stdio: "inherit" });
    console.log(`  • notarized + stapled ${file}`);
  }
  return [];
};
