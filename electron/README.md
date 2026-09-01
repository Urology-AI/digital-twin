# COMPASS Digital Twin — offline macOS app

A native Mac wrapper (Electron) around the COMPASS web app. Everything runs
locally: all prediction models, the 3D viewer, case entry, and the local
case log / patient library (stored in the app's own storage on the Mac).

Network-only features are compiled out of this build (`VITE_OFFLINE=1`):
LLM chat / "paste clinic note", Turso cloud sync (push/pull), Cloudflare
Access sign-in, and cloud share links.

## Build locally

```bash
npm run electron        # build + launch (dev smoke test)
npm run dist:mac        # produce release/*.dmg + *.zip + latest-mac.yml
```

An unsigned `.dmg` is fine for your own testing. macOS Gatekeeper will warn
recipients unless it is signed and notarized.

## Signing & notarization

Requires an Apple Developer account ($99/yr) and a **Developer ID Application**
certificate (in your login keychain, or exported as a `.p12`).

Copy `.env.example` to `.env` at the repo root and fill it in — `electron-builder`
loads it automatically. `.env` is gitignored; never commit it.

## Releases & auto-update

This repo is **public**, so releases go to a separate **private** repo,
`Urology-AI/digital-twin-releases`, and are never publicly downloadable.
`.github/workflows/release-mac.yml` builds, signs, notarizes and publishes
there on a `vX.Y.Z` tag. Installed apps read that private feed with a
read-only token baked into the bundle and self-update via `electron-updater`.

### One-time setup

Two fine-grained GitHub PATs (github.com → Settings → Developer settings →
Fine-grained tokens), each scoped to **only** `Urology-AI/digital-twin-releases`:

| PAT | Repository access | Used by |
| --- | --- | --- |
| `RELEASES_WRITE_PAT` | Contents: **Read and write** | CI, to publish the release |
| `RELEASES_READ_PAT`  | Contents: **Read-only**     | baked into the app, to fetch updates |

Repo secrets to add (Settings → Secrets and variables → Actions):
`MAC_CERT_P12` (base64 of the .p12), `MAC_CERT_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `RELEASES_WRITE_PAT`,
`RELEASES_READ_PAT`.

Run the workflow once with **preflight** checked to verify every secret.

### Cut a release

```bash
npm version patch && git push --follow-tags
```

### Local publish (instead of CI)

```bash
cp electron/update-auth.example.json electron/update-auth.json   # add the read PAT
export GH_TOKEN=<the RELEASES_WRITE_PAT>
npm run dist:mac -- --publish always
```
