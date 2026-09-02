// Electron shell for the COMPASS Digital Twin — a fully offline macOS app.
//
// The web app is a static SPA (all prediction models run in-browser). We serve
// the built `dist/` from a custom `app://compass/` scheme rather than file://
// so that `base: "/"` asset URLs and pathname routing work unchanged AND the
// origin is stable across launches (a random localhost port would change the
// origin every time and wipe localStorage). The window loads `/clinical`
// deliberately: any other path puts the app in demo mode (see
// src/lib/demoMode.ts).

const { app, BrowserWindow, shell, protocol, net, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { deviceEnrollment } = require("./managed.cjs");

// In the packaged app the web build ships as a plain resource directory
// (electron-builder `extraResources`), NOT inside app.asar — unpacking a big
// asset tree from the asar breaks notarization stapling on macOS 15+.
const DIST = app.isPackaged
  ? path.join(process.resourcesPath, "app-dist")
  : path.join(__dirname, "..", "dist");
const ORIGIN = "app://compass";

let mainWindow = null;

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// Only one running copy — otherwise a second launch could fight over the
// scheme handler / auto-update.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    protocol.handle("app", (req) => {
      const { pathname } = new URL(req.url);
      const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
      let target = path.join(DIST, rel);
      // Block traversal and fall back to the SPA entry for client-side routes.
      // The separator matters: a bare startsWith(DIST) would also accept a
      // sibling directory whose name merely begins with "app-dist".
      if (!target.startsWith(DIST + path.sep) || !path.extname(target)) {
        target = path.join(DIST, "index.html");
      }
      return net.fetch(pathToFileURL(target).toString());
    });

    createWindow();
    setupAutoUpdate();
  });
}

function send(type, extra) {
  mainWindow?.webContents.send("updates:event", { type, ...extra });
}

// True once setupAutoUpdate has wired the listeners and a usable feed.
let updaterReady = false;

// Worker-backed update feed (see cf-worker/src/index.ts, /api/updates/*).
const UPDATE_FEED_URL = "https://digital-twin.urology.edu.eu.org/api/updates";

function setupAutoUpdate() {
  // Fully usable offline; this only does anything when the machine happens to
  // be online. Pulls a newer signed build in the background through the
  // Worker-backed feed below.

  // electron-updater logs to console by default; visible via Console.app or by
  // launching the .app from a terminal. "Update check failed" in the UI now
  // also carries the underlying message (see the 'error' handler below).
  autoUpdater.autoDownload = true;
  // Differential download is on by default and DOES work on macOS in
  // electron-updater 6 (MacUpdater caches the previous update.zip and fetches
  // only the changed blocks). It needs three things, all of which hold here:
  // the .zip.blockmap published alongside the .zip, a feed that serves it, and
  // a feed that honours Range requests — the Worker does both. So a typical
  // update pulls a few MB rather than the ~110 MB the .zip weighs. The first
  // update after an install is always full: there is no previous zip to diff
  // against yet.
  autoUpdater.on("checking-for-update", () => send("checking"));
  autoUpdater.on("update-available", (i) => send("available", { version: i.version }));
  autoUpdater.on("update-not-available", () => send("none"));
  autoUpdater.on("error", (e) => send("error", { message: String(e && e.message ? e.message : e) }));
  autoUpdater.on("update-downloaded", (info) => {
    send("downloaded", { version: info.version });
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        message: `Update ${info.version} is ready`,
        detail: "Restart COMPASS Digital Twin to apply it. Your saved cases are kept.",
      })
      .then(({ response }) => { if (response === 0) autoUpdater.quitAndInstall(); });
  });

  // An unpacked/dev run has no feed — checkForUpdates() would throw a confusing
  // error. Skip silently; a dev build is never the thing that needs updating.
  if (!app.isPackaged) return;

  // The feed is our Cloudflare Worker, which holds the read-only GitHub token
  // as a Worker secret and streams latest-mac.yml and the release assets from
  // the private releases repo. The app therefore ships with NO credential of
  // its own: earlier builds baked RELEASES_READ_PAT into the bundle, where any
  // user could extract it and it could not be rotated without a new release.
  autoUpdater.setFeedURL({ provider: "generic", url: UPDATE_FEED_URL });

  updaterReady = true;
  autoUpdater.checkForUpdates().catch(() => { /* surfaced via the 'error' event */ });
}

ipcMain.handle("app:version", () => app.getVersion());
// Advisory device-management check — see electron/managed.cjs for why it is
// only ever advisory.
ipcMain.handle("device:enrollment", () => deviceEnrollment());
ipcMain.handle("updates:check", async () => {
  if (!updaterReady) {
    send("error", {
      message: app.isPackaged
        ? "updates unavailable in this build"
        : "updates only run in an installed build",
    });
    return;
  }
  try { await autoUpdater.checkForUpdates(); } catch (e) { send("error", { message: String(e && e.message ? e.message : e) }); }
});
// Restart into a downloaded update. The 'update-downloaded' dialog above offers
// this too, but it is dismissable — the in-app badge is the way back to it.
ipcMain.handle("updates:install", () => {
  if (updaterReady) autoUpdater.quitAndInstall();
});

// A URL is "internal" only if its origin is exactly ours — a string prefix
// test would accept "app://compass.evil.example".
function isInternal(url) {
  try { return new URL(url).origin === ORIGIN; } catch { return false; }
}

// Only ever hand http/https to the OS. shell.openExternal on an arbitrary
// scheme can launch other applications (file:, smb:, custom handlers).
function openExternally(url) {
  try {
    const { protocol } = new URL(url);
    if (protocol === "http:" || protocol === "https:") shell.openExternal(url);
  } catch { /* not a URL — ignore */ }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    title: "COMPASS — Digital Twin",
    backgroundColor: "#0b0b0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Default since Electron 20, but stated explicitly: this is a security
      // property of the app, not something to inherit silently from a default
      // that a future upgrade or an added webPreference could flip.
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.loadURL(`${ORIGIN}/clinical`);
  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) return { action: "allow" };
    openExternally(url);
    return { action: "deny" };
  });

  // setWindowOpenHandler only covers NEW windows. Without this, a top-level
  // navigation of the main window itself would land a foreign page on the
  // app:// origin, with the preload bridge attached and read access to the
  // localStorage holding every saved case. Keep both guards.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isInternal(url)) return;
    event.preventDefault();
    openExternally(url);
  });

  // Nothing in this app uses <webview>; refuse to attach one at all rather
  // than rely on its own webPreferences being safe.
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
