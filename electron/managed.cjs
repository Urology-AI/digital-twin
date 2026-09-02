// Is this machine enrolled in Mount Sinai device management?
//
// ADVISORY ONLY. Everything here is the client reporting on itself, so a
// determined user can defeat it (patched binary, spoofed command output). It
// exists to tell an honest user "you're running this on a personal laptop",
// not to enforce anything. Real enforcement has to happen server-side — a
// Cloudflare Access / WARP device-posture rule, or an MDM-issued client
// certificate — which the offline build has no network to do.
//
// Detection:
//   macOS   — `profiles status -type enrollment` reports MDM enrollment; the
//             enrolled organisation comes from the installed profiles.
//   Windows — `dsregcmd /status` reports Azure AD / domain join and the tenant.

const { execFile } = require("node:child_process");

// Which organisation counts as "managed by Sinai". Matched case-insensitively
// against the org/tenant/domain strings the OS reports.
// TODO(sinai-it): confirm the exact Azure AD tenant name and macOS MDM org.
const SINAI_MARKERS = ["mount sinai", "mountsinai", "mssm", "sinai"];

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000, windowsHide: true }, (err, stdout) => {
      resolve(err && !stdout ? "" : String(stdout || ""));
    });
  });
}

function matchesSinai(text) {
  const t = String(text || "").toLowerCase();
  return SINAI_MARKERS.some((m) => t.includes(m));
}

async function macEnrollment() {
  const status = await run("/usr/bin/profiles", ["status", "-type", "enrollment"]);
  // "MDM enrollment: Yes (User Approved)" / "No"
  const enrolled = /MDM enrollment:\s*Yes/i.test(status);
  const dep = /Enrolled via DEP:\s*Yes/i.test(status);
  if (!enrolled) {
    return { managed: false, org: null, detail: "No MDM enrollment found on this Mac." };
  }
  // Organisation name, when the enrollment profile is readable.
  const profiles = await run("/usr/bin/profiles", ["-L"]);
  const org = matchesSinai(profiles) || matchesSinai(status) ? "Mount Sinai" : null;
  return {
    managed: true,
    org,
    detail: dep ? "Enrolled in MDM (automated device enrollment)." : "Enrolled in MDM.",
  };
}

async function winEnrollment() {
  const status = await run("dsregcmd", ["/status"]);
  const value = (key) => {
    const m = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "im").exec(status);
    return m ? m[1].trim() : "";
  };
  const aad = /^\s*YES$/i.test(value("AzureAdJoined"));
  const domain = /^\s*YES$/i.test(value("DomainJoined"));
  const tenant = value("TenantName") || value("DomainName");
  if (!aad && !domain) {
    return { managed: false, org: null, detail: "This PC is not domain- or Entra-joined." };
  }
  return {
    managed: true,
    org: matchesSinai(tenant) ? "Mount Sinai" : tenant || null,
    detail: aad ? "Joined to Microsoft Entra ID." : "Joined to an Active Directory domain.",
  };
}

/**
 * @returns {Promise<{managed: boolean, org: string|null, detail: string, platform: string}>}
 */
async function deviceEnrollment() {
  const platform = process.platform;
  try {
    const base =
      platform === "darwin" ? await macEnrollment()
      : platform === "win32" ? await winEnrollment()
      : { managed: false, org: null, detail: "Enrollment check not supported on this platform." };
    return { ...base, platform };
  } catch {
    return { managed: false, org: null, detail: "Could not read the device's enrollment state.", platform };
  }
}

module.exports = { deviceEnrollment };
