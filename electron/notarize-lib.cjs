// Shared notarization helpers for the afterSign (app) and
// afterAllArtifactBuild (dmg) hooks.

const { execFileSync } = require("node:child_process");
const { rmSync } = require("node:fs");
const path = require("node:path");

function creds() {
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    throw new Error("Apple notarization credentials are not in the environment");
  }
  return ["--apple-id", APPLE_ID, "--password", APPLE_APP_SPECIFIC_PASSWORD, "--team-id", APPLE_TEAM_ID];
}

const sleep = (s) => execFileSync("sleep", [String(s)]);

// Submit a file (zip / dmg) to the notary service and block until Apple
// returns a verdict. Throws unless the verdict is "Accepted". Returns the
// submission id so the caller can pull the log.
function submit(filePath) {
  const out = execFileSync(
    "xcrun",
    ["notarytool", "submit", filePath, ...creds(), "--wait", "--timeout", "30m", "--output-format", "json"],
    { encoding: "utf8" },
  );
  let res;
  try {
    res = JSON.parse(out);
  } catch {
    throw new Error(`notarytool submit returned non-JSON output:\n${out}`);
  }
  console.log(`  • notarytool: id=${res.id} status=${res.status}`);
  if (res.status !== "Accepted") {
    dumpNotaryLog(res.id);
    throw new Error(`notarization ${res.status} for ${path.basename(filePath)} (id ${res.id})`);
  }
  return res.id;
}

// Print the full notary log. "Accepted" can still carry warnings that later
// invalidate the ticket, so always surface it in CI output.
function dumpNotaryLog(id) {
  if (!id) return;
  try {
    const log = execFileSync("xcrun", ["notarytool", "log", id, ...creds()], { encoding: "utf8" });
    console.log(`  • notarytool log ${id}:\n${log}`);
  } catch (e) {
    console.log(`  • could not fetch notary log for ${id}: ${e.message}`);
  }
}

// Zip the .app the way notarytool expects and submit it.
function notarizeApp(appPath) {
  const zipPath = `${appPath}-notarize.zip`;
  execFileSync("ditto", ["-c", "-k", "--keepParent", appPath, zipPath], { stdio: "inherit" });
  try {
    return submit(zipPath);
  } finally {
    rmSync(zipPath, { force: true });
  }
}

// Staple with retries — the ticket can lag a few seconds behind an "Accepted"
// verdict on Apple's distribution endpoint, and a bare `stapler staple` fails
// hard when it races ahead.
function staple(target) {
  const delays = [0, 15, 30, 60, 120];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) sleep(delays[i]);
    try {
      execFileSync("xcrun", ["stapler", "staple", target], { stdio: "inherit" });
      return;
    } catch (e) {
      if (i === delays.length - 1) throw e;
      console.log(`  • staple attempt ${i + 1} failed, retrying: ${e.message}`);
    }
  }
}

module.exports = { submit, notarizeApp, staple, dumpNotaryLog };
