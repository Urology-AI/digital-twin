// Minimal bridge for the packaged app: app version + manual update check.
// The renderer stays sandboxed; only these three calls cross over.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  version: () => ipcRenderer.invoke("app:version"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  onUpdateEvent: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("updates:event", handler);
    return () => ipcRenderer.removeListener("updates:event", handler);
  },
});
