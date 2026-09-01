// afterAllArtifactBuild hook — staple the notarization ticket onto the .dmg
// itself (the .app inside is already stapled by notarize.cjs). Belt-and-braces
// so a fresh download validates before it's ever opened.

const { execFileSync } = require("node:child_process");

exports.default = function stapleDmg(context) {
  if (process.platform !== "darwin") return [];
  if (!process.env.APPLE_ID) return [];

  for (const file of context.artifactPaths) {
    if (!file.endsWith(".dmg")) continue;
    try {
      execFileSync("xcrun", ["stapler", "staple", file], { stdio: "inherit" });
      console.log(`  • stapled ${file}`);
    } catch (err) {
      console.warn(`  • could not staple ${file}: ${err.message}`);
    }
  }
  return [];
};
