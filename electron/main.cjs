// Electron shell for the COMPASS Digital Twin — a fully offline macOS app.
//
// The web app is a static SPA (all prediction models run in-browser). We serve
// the built `dist/` over a loopback HTTP server rather than file:// so that
// `base: "/"` asset URLs and pathname-based routing work unchanged. The window
// loads `/clinical` deliberately: any other path puts the app in demo mode
// (no persistence, no saved data — see src/lib/demoMode.ts).

const { app, BrowserWindow, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const DIST = path.join(__dirname, "..", "dist");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".glb": "model/gltf-binary",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".wasm": "application/wasm",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.join(DIST, urlPath);

      // Prevent path traversal outside dist/.
      if (!filePath.startsWith(DIST)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // SPA fallback — serve index.html for client-side routes.
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(path.join(DIST, "index.html")).pipe(res);
    });

    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

async function createWindow() {
  const port = await startServer();

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

  win.loadURL(`http://127.0.0.1:${port}/clinical`);

  // Open external links (if any) in the system browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1:")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  // The app is fully usable offline; this only does anything when the machine
  // happens to be online. Checks the GitHub Releases feed, downloads a newer
  // signed build in the background and installs it on next quit. Silent on
  // failure (offline, no release, etc.).
  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
