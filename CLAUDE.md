# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Behavioral guidelines

These bias toward caution over speed. Use judgment for trivial tasks.

### 1. Think before coding
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, surface them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what's confusing, and ask.

### 2. Simplicity first
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code, no "flexibility" that wasn't requested, no error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it. Senior-engineer test: would they call this overcomplicated?

### 3. Surgical changes
- Touch only what you must. Don't "improve" adjacent code, comments, or formatting.
- Match existing style even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables your change orphaned; don't remove pre-existing dead code unless asked.
- Test: every changed line should trace directly to the request.

### 4. Goal-driven execution
- Convert tasks into verifiable goals ("add validation" → "tests for invalid inputs pass"; "fix bug" → "test reproducing the bug passes").
- For multi-step work, state a short plan with a verify-step per item before starting.

---

## Commands

```bash
npm install              # install deps
npm run dev              # Vite dev server (default http://localhost:5173)
npm run build            # production build to dist/
npm run preview          # serve the built bundle
npm run typecheck        # tsc --noEmit (strict)
npm test                 # vitest run (one-shot)
npm run test:watch       # vitest in watch mode
./run-dev.sh             # run frontend + FastAPI backend together; pass LLM_ENDPOINT as $1 or env var
```

Run a single test file: `npx vitest run src/test/models.test.ts`. Run a single test by name: `npx vitest run -t "predictEcePatient"`.

Backend (optional, for LLM chat/analyze): `cd backend && python3 -m uvicorn main:app --reload`. Requires `LLM_ENDPOINT` env var; `ADMIN_TOKEN` gates `/api/config` and pre-save `/api/test`.

Path alias: `@/*` → `src/*` (configured in `vite.config.ts` and `tsconfig.json`). Use it in all imports.

---

## Architecture

Single-page React + TypeScript app. All COMPASS prediction models run in the browser; the optional FastAPI backend (`backend/main.py`) only proxies an external vLLM-compatible chat endpoint for the chat/analyze features.

### Data flow (the spine)

```
patients.json / localStorage / imported JSON
        │  (schema: prostate-3d-input-v1)
        ▼
usePatientStore (Zustand, src/store/patientStore.ts)
   patients[], activeId, lesionRows
        │
        │ on any mutation → recompute()
        ▼
clinicalStateFromRecord() → deriveClinicalFromLesions()
        │   (record → flat ClinicalState S used by all models)
        ▼
mapLesionsToZones(zones, lesionRows, S)
        ▼
runCompassModels(S, record, lesionRows, threeZones)
        │   src/lib/compass/runCompass.ts — orchestrator
        ▼
predictions: { ece, svi, upgrade, psm, bcr, lni, extensive,
               nsL/nsR (+ nsDetailL/R), eceL/R, sviL/R }
        │
        ├──► PredictionPanel / FunctionalOutcomesPanel (numbers)
        └──► mapZoneDataToThree() → ThreeCanvas (3D zones)
```

Two stores, distinct concerns:
- `patientStore` — patient data, lesions, predictions, undo/redo history (snapshot-based, `HISTORY_LIMIT = 40`), and three persistence layers in localStorage (`compass-digital-twin-state` for the working set, `compass-patient-library` for saved cases, `compass_cases` for legacy CaseLog entries; bumping `STORAGE_VERSION` invalidates the working set).
- `uiStore` — UI-only state (open panels, dark mode, mobile/desktop tab selection, explain modal).

### COMPASS models

Six prediction models live as small pure functions in `src/lib/models/`: `ece.ts` (patient + side + extensive), `svi.ts` (patient + side), `upgrade.ts`, `psm.ts`, `bcr.ts`, `lni.ts`. Each takes `ClinicalState` (`src/types/patient.ts`) and returns a probability; `runCompass.ts` calls them and clamps results to model-card-defined ranges.

Higher-level logic in `src/lib/compass/`:
- `nsGrade.ts` — zone-aware nerve-sparing grade (5-zone algorithm) per side.
- `plnd.ts` — PLND decision module.
- `functionalOutcomes.ts` — continence/erectile recovery predictions.
- `mapZoneData.ts`, `lesionZones.ts`, `dimensions.ts` — geometry/zone bookkeeping that bridges the clinical record and the 3D mesh.
- `clinicalFromRecord.ts` ↔ `recordFactory.ts` — bidirectional mapping between the JSON schema (`Prostate3DInputV1`) and the flat `ClinicalState` shape models actually consume.
- `constants.ts` — `COMPASS_TO_3D` zone-id map, default zone/three-runtime factories.

Model coefficients also live in machine-readable form at `models/coefficients.json` (referenced by the model card; the TypeScript files are the source of truth at runtime).

### 3D viewer

`ThreeCanvas` is mounted **once** at the top of `App.tsx` so the WebGL context survives tab switches — overlays/workspaces are stacked on top with z-index, never re-mounted (see comment around `App.tsx:113-130`). The Three.js setup lives in `src/lib/three/` (`prostateScene.ts`, `noise.ts`, `zoomBridge.ts`) and is wired in via `useThreeProstate.ts`.

Layout: desktop has three tabs (`viewer`, `input`, `predictions`) controlled by `uiStore.desktopTab`; mobile uses `mobileWorkspace` (`insights`/`clinical`/`outcomes`/`reference`) plus a bottom tab bar. Both share the same single Three canvas underneath.

### Schema & types

- `Prostate3DInputV1` (`src/types/patient.ts`) — the on-disk/JSON shape, identified by `_schema: "prostate-3d-input-v1"`. `importJsonFile` rejects anything else.
- `ClinicalState` — flat runtime shape models read from. `defaultClinicalState()` defines defaults.
- `LesionRow` (`src/types/lesion.ts`) — UI-editable lesion shape; converted via `lesionsFromRows`/`lesionsFromRecordJson`.
- `CompassPredictions` / `ThreeZoneRuntime` (`src/types/prediction.ts`) — outputs.

Form validation uses `zod` schemas in `src/schemas/clinicalForm.ts` with React Hook Form.

### LLM integration

Two paths exist; pick based on whether the user has a backend running:
- Direct browser → vLLM: `src/lib/api.ts` reads endpoint/model/key from `localStorage` (or `VITE_LLM_*` env vars) and calls the chat-completions endpoint directly.
- Browser → FastAPI → vLLM: `backend/main.py` exposes `/api/chat`, `/api/analyze`, `/api/config` (admin-token gated), `/api/test`, `/health`. Used when CORS or key secrecy matters.

Both share the same system prompt structure (`VIEWER_CONTEXT` + `GUARDRAILS` + clinical block); keep them in sync if you change one.

---

## Project-specific gotchas

- **Recompute on every mutation.** The store calls `recompute()` after every patient mutation; if you add a new mutator, do the same or predictions will be stale.
- **Don't unmount `ThreeCanvas`.** Tabs use CSS visibility, not conditional rendering, for this reason. Initializing Three.js is expensive and the WebGL context is lost on remount.
- **`STORAGE_VERSION` bumps wipe user state.** Bump it only when the default schema actually changed; document why.
- **Clinical record vs. ClinicalState.** Models always take `ClinicalState`. If you add a clinical input, plumb it through both `clinicalFromRecord.ts` (read) and `recordFactory.ts` / `updateClinicalForm` in the store (write), or values silently won't round-trip.
- **Research use only.** This is decision support for prostate-cancer surgical planning under IRB STUDY-14-00050 (Mount Sinai); not FDA cleared. Don't introduce changes that imply clinical certification or autonomous decision-making. See `MODEL_CARD.md` and `DATA_DICTIONARY.md` before touching model logic, coefficients, or input ranges.
