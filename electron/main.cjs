// Electron shell for the COMPASS Digital Twin — a fully offline macOS app.
//
// The web app is a static SPA (all prediction models run in-browser). We serve
// the built `dist/` from a custom `app://compass/` scheme rather than file://
// so that `base: "/"` asset URLs and pathname routing work unchanged AND the
// origin is stable across launches (a random localhost port would change the
// origin every time and wipe localStorage). The window loads `/clinical`
// deliberately: any other path puts the app in demo mode (see
// src/lib/demoMode.ts).

const { app, BrowserWindow, shell, protocol, net } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DIST = path.join(__dirname, "..", "dist");
const ORIGIN = "app://compass";

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// Only one running copy — otherwise a second launch could fight over the
// scheme handler / auto-update.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    protocol.handle("app", (req) => {
      const { pathname } = new URL(req.url);
      let rel = decodeURIComponent(pathname).replace(/^\/+/, "");
      let target = path.join(DIST, rel);
      // Block traversal and fall back to the SPA entry for client-side routes.
      if (!target.startsWith(DIST) || !path.extname(target)) {
        target = path.join(DIST, "index.html");
      }
      return net.fetch(pathToFileURL(target).toString());
    });

    createWindow();

    // Fully usable offline; this only does anything when the machine happens
    // to be online. Pulls a newer signed build from the PRIVATE releases repo
    // in the background and installs it on quit. Silent on failure.
    // The read-only token is written into the bundle at build time (CI, from
    // the RELEASES_READ_PAT secret) — see electron/update-auth.example.json.
    try {
      const auth = require("./update-auth.json");
      if (auth && auth.token) autoUpdater.addAuthHeader(`token ${auth.token}`);
    } catch { /* no token bundled — updates just won't run */ }
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  });
}

function createWindow() {
  const win = new BrowserWindow({
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
    },
  });

  win.loadURL(`${ORIGIN}/clinical`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
