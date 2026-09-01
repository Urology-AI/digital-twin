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
certificate. Set these before `npm run dist:mac`:

```bash
export CSC_LINK=/path/to/DeveloperID.p12      # or base64 string in CI
export CSC_KEY_PASSWORD=…
export APPLE_ID=you@example.com
export APPLE_APP_SPECIFIC_PASSWORD=…          # appleid.apple.com → App-Specific Passwords
export APPLE_TEAM_ID=XXXXXXXXXX
```

## Releases & auto-update

`.github/workflows/release-mac.yml` builds, signs, notarizes and publishes to
a GitHub Release when you push a `vX.Y.Z` tag. Installed apps check that
release feed on launch (when online) and self-update via `electron-updater`.

Add these repo secrets: `MAC_CERT_P12` (base64 of the .p12),
`MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

To cut a release:

```bash
npm version patch && git push --follow-tags
```
