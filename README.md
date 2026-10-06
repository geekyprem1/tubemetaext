# TubeMeta AI

Chrome Manifest V3 extension that extracts the current supported YouTube video's public metadata, lets you edit title/description/tags/hashtags, and copies individual fields or the full record. Local-only: no backend, no analytics, no remote code.

This repository is currently at the **production scaffold** stage (see `TASKS.md`, T006+). The extraction/edit/copy workflows are not implemented yet; the `phase0-prototype/` folder holds the disposable feasibility prototype that validated the extraction sources — see `docs/feasibility.md`.

## Prerequisites

- Node.js 22.12+ (developed on Node 24) and npm
- Google Chrome (loads the built `dist/` unpacked)

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (note: this environment sets `NODE_ENV=production`, so use `npm install --include=dev` if devDependencies are skipped) |
| `npm run dev` | Rebuild `dist/` on change (Vite watch for popup, worker, and content script) |
| `npm run build` | Production build into `dist/` + build verification |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over the repository |
| `npm run test` | Vitest unit tests |
| `npm run package` | Build + create `release/tubemeta-ai-v<version>.zip` |

## Loading in Chrome

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the `dist/` folder.
3. Open a supported YouTube `/watch` or `/shorts/<id>` page and click the TubeMeta AI toolbar icon.

## Build outputs

`dist/` contains exactly the production extension files:

- `manifest.json` — generated from the single source of truth `src/manifest.ts`
- `popup.html` + hashed assets — React popup
- `worker.js` — MV3 module service worker (single bundled file)
- `content.js` — self-contained isolated-world content script (IIFE, no imports)
- `icons/` — toolbar and store icons

The build runs `scripts/verify-build.mjs`, which checks that the manifest and popup reference only existing files, that the bundled worker/content scripts contain no unresolved or dynamic imports, and that the self-contained main-world reader (`readCurrentPlayerResponse`) still survives bundling and function serialization.

## Layout

```
src/
  manifest.ts        # manifest source of truth -> dist/manifest.json
  background/        # MV3 module service worker (worker.js)
  content/           # isolated content script + main-world reader function
  domain/            # pure YouTube URL logic (no Chrome or React dependencies)
  popup/             # React popup (popup.html)
  shared/            # messages, errors, limits
tests/unit/          # Vitest unit tests
scripts/             # build.mjs, verify-build.mjs, package.mjs
docs/                # feasibility evidence and source matrix from Phase 0
phase0-prototype/    # disposable feasibility prototype (excluded from the production toolchain)
```
