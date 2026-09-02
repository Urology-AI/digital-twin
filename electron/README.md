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

Notarization is done by two hooks (electron-builder's built-in `mac.notarize`
is off): `electron/notarize.cjs` (`afterSign`) submits and staples the `.app`
before it's packed; `electron/notarize-artifacts.cjs` (`afterAllArtifactBuild`)
submits and staples the finished `.dmg` (needed on macOS 15+, where an
un-notarized disk image trips "Apple could not verify …" even when the `.app`
inside is fine) and patches its now-stale `sha512`/`size` in `latest-mac.yml`.

The release workflow's `verify` job then re-checks the published `.dmg` and
`.zip` on a **separate** `macos-15` runner with Apple's online notarization
endpoints blocked — so `stapler`/`spctl` can only pass from an embedded
ticket, exactly like a user's Mac offline. It must run on a runner that never
performed the notarization: the same runner keeps a warm Gatekeeper cache that
reports "notarized" even when the shipped ticket is invalid.

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
export GH_TOKEN=<the RELEASES_WRITE_PAT>
npm run dist:mac -- --publish always
```

The built app needs no token of its own: it reads updates through the
Cloudflare Worker (`/api/updates/*`), which holds the read-only
`RELEASES_READ_PAT` as a Worker secret. Set it once with:

```bash
cd cf-worker && npx wrangler secret put RELEASES_READ_PAT
```

## Update size

Updates are differential. electron-updater caches the previous `update.zip`
and, using the `.zip.blockmap` published alongside it, downloads only the
changed blocks — a typical update is a few MB rather than the ~110 MB the full
`.zip` weighs. This needs a feed that serves the blockmap and honours `Range`
requests; the Worker (`/api/updates/*`) does both. The first update after a
fresh install is always a full download, since there is no previous zip to diff
against.

Note that a full signed release is still what ships **every** change, including
changes confined to `src/`. That is deliberate: it keeps Apple's notarization
in the path for every line of code users run. Shipping the web bundle
out-of-band would move executable content outside the code signature, into a
user-writable directory where nothing re-verifies it — not an acceptable trade
for a tool handling PHI.
