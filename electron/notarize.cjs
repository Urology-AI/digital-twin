// afterSign hook — notarize the .app with Apple and staple the ticket so the
// build passes Gatekeeper offline. electron-builder's built-in `notarize: true`
// submits but does not reliably staple, hence this explicit step.

const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== "darwin") return;

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log("  • skipping notarization — APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;

  console.log(`  • notarizing ${appPath}`);
  await notarize({
    tool: "notarytool",
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
  console.log("  • notarized + stapled");
};
