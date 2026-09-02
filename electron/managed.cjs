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

// Which organisation counts as "managed by Sinai".
//
// The strongest identifier readable without root on both platforms is the
// Microsoft Entra (Azure AD) *tenant id* the device is registered to — a
// stable GUID, unlike display names. Fill it in and the badge can say "Sinai
// device" rather than a generic "Managed".
// TODO(sinai-it): confirm this GUID. It is the tenant read off an enrolled
// Sinai-issued Mac (Intune / Entra) during development, not a value from IT —
// verify it in the Entra admin centre, or with `dsregcmd /status` on a
// known-good Sinai PC, before relying on the "Sinai device" badge.
const SINAI_TENANT_IDS = ["77e89d61-570f-43b0-b9e4-634f462e34b8"];

// Fallback for names the OS does report (Windows TenantName / AD domain).
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

// The Entra tenant this Mac is workplace-joined to. `profiles show -type
// enrollment` would say it too, but that needs root; Company Portal records the
// tenant id in its own (user-readable) preferences.
async function macTenantId() {
  const out = await run("defaults", [
    "read",
    "com.microsoft.CompanyPortalMac",
    "wpj-registration-seq-num-per-tenant-dictionary",
  ]);
  const m = /"?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"?\s*=/i.exec(out);
  return m ? m[1].toLowerCase() : null;
}

async function macEnrollment() {
  const status = await run("/usr/bin/profiles", ["status", "-type", "enrollment"]);
  // "MDM enrollment: Yes (User Approved)" / "No"
  const enrolled = /MDM enrollment:\s*Yes/i.test(status);
  const dep = /Enrolled via DEP:\s*Yes/i.test(status);
  if (!enrolled) {
    return { managed: false, org: null, detail: "No MDM enrollment found on this Mac." };
  }
  const tenant = await macTenantId();
  const org =
    (tenant && SINAI_TENANT_IDS.includes(tenant)) || matchesSinai(status)
      ? "Mount Sinai"
      : null;
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
  const tenantName = value("TenantName") || value("DomainName");
  const tenantId = value("TenantId").toLowerCase();
  if (!aad && !domain) {
    return { managed: false, org: null, detail: "This PC is not domain- or Entra-joined." };
  }
  const sinai = SINAI_TENANT_IDS.includes(tenantId) || matchesSinai(tenantName);
  return {
    managed: true,
    org: sinai ? "Mount Sinai" : tenantName || null,
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
