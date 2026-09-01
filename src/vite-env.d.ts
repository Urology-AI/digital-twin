/// <reference types="vite/client" />

declare module "*.json" {
  const value: unknown;
  export default value;
}

/** App version, injected at build time (vite.config.ts). */
declare const __APP_VERSION__: string;

interface Window {
  /** Present only in the packaged Electron app (see electron/preload.cjs). */
  desktop?: {
    version: () => Promise<string>;
    checkForUpdates: () => Promise<void>;
    onUpdateEvent: (cb: (e: { type: string; version?: string; message?: string }) => void) => () => void;
  };
}
