import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { DownloadPage } from "./components/DownloadPage";
import { ToastProvider } from "./components/ui/toast";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      {/*
        /clinical/download is a standalone page (no patient store, no 3D canvas),
        under /clinical so Cloudflare Access gates it like the rest of the tool.
      */}
      {window.location.pathname.startsWith("/clinical/download") ? <DownloadPage /> : <App />}
    </ToastProvider>
  </StrictMode>,
);
