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
      if (!target.startsWith(DIST) || !path.extname(target)) {
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

function setupAutoUpdate() {
  // Fully usable offline; this only does anything when the machine happens to
  // be online. Pulls a newer signed build from the PRIVATE releases repo in
  // the background. The read-only token is written into the bundle at build
  // time (CI, from RELEASES_READ_PAT) — see electron/update-auth.example.json.
  try {
    const auth = require("./update-auth.json");
    if (auth && auth.token) autoUpdater.addAuthHeader(`token ${auth.token}`);
  } catch { /* no token bundled — updates just won't run */ }

  autoUpdater.autoDownload = true;
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

  autoUpdater.checkForUpdates().catch(() => {});
}

ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("updates:check", async () => {
  try { await autoUpdater.checkForUpdates(); } catch (e) { send("error", { message: String(e) }); }
});

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
    },
  });

  mainWindow.loadURL(`${ORIGIN}/clinical`);
  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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
