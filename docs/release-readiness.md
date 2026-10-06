# Release readiness report (T024)

**Reconciled:** 2026-10-06  
**Artifact:** production `dist/` (loadable unpacked; `npm run package` produces the release ZIP at T026)  
**Verification run:** `npm run build` PASS (with build verification), `tsc --noEmit` PASS, `eslint .` PASS, `vitest run` 115/115 PASS (19 files)

This report reconciles the built product against PRD Section 42 and the architecture decision records. Failed or unevidenced criteria stay open until resolved.

## PRD Section 42 — feature checklist

| Criterion | Status | Evidence |
| --- | --- | --- |
| Extension installs successfully | PASS | Loaded unpacked across all live sessions; enabled with no errors |
| YouTube video is detected | PASS | T017 live E2E; T020 corpus (12 watch) |
| YouTube Short is detected | PASS | T020 corpus (22 Shorts); contentType `short` set from the active route |
| Title is extracted | PASS | T020: 34/34 titles correct against visible evidence |
| Description is extracted | PASS | T020: 26 available + 8 confirmed empty, 0 unavailable; expanded-description proof 6/6 |
| Hashtags are extracted | PASS | Derived and stored end-to-end (T017 E2E: 5 hashtags); partial/unavailable rules unit-tested |
| Publicly accessible tags are extracted when available | PASS | T020: 23/34 keyword lists present (labeled candidates); absent kept unavailable — never fabricated |
| Video URL is extracted | PASS | Canonical URL in every snapshot (T019/T020) |
| Channel name is extracted | PASS | Live E2E summary/details; corpus snapshots |
| Thumbnail is extracted | PASS | Rendered in the T017 E2E screenshot from an allowlisted `ytimg.com` URL |
| Video type is identified | PASS | Shorts route → `short`; watch → `unknown` (honest; duration never used) |
| Duration is extracted where available | PASS | Live E2E `3:33`; suppressed for live/upcoming by design |
| Views are extracted where available | PASS | Exact integer counts; zero preserved; abbreviations rejected |
| Publish date is extracted where available | PASS | Date-only values; relative dates unavailable |
| User can edit fields | PASS | T016 + live edit with `Saved` acknowledgement (T017/T021) |
| User can copy individual fields | PASS | Exact §11 values; live field-copy click returned "Copied to clipboard." (T021 session) |
| User can copy everything | PASS | T017 live: exact 3,484-char export captured from the OS clipboard |
| SPA navigation works | PASS (unit + design; live in-popup pass in manual QA) | Navigation observer with lease, VIDEO_INVALIDATED relay, marker/URL acceptance rejection (T013/T019); no live mid-popup navigation run performed |
| Loading state works | PASS | Live resolving/extracting states; bounded 5 s deadline (tests) |
| Error state works | PASS | Live `ACCESS_DENIED` and unsupported states; controlled messages per code |
| No unnecessary permissions are requested | PASS | T023: `activeTab`, `scripting`, `storage`, `clipboardWrite`; no host permissions |
| No API key is exposed | PASS | T023: no keys or provider code in the artifact |
| Chrome Web Store build passes production testing | PASS | `docs/release-archive.md` (T026): the shipped ZIP was extracted and loaded clean; the packaged reader extracted watch + Shorts pages correctly; a live toolbar invocation produced a session and the copy action wrote the exact §11 export (3,484 chars) to the system clipboard; the stale-session identity guard rejected a post-navigation copy (`VIDEO_CHANGED`). A copy-feedback visibility defect found during this smoke was fixed (auto-scroll to the confirmation) and re-verified before packaging |

## Release gates

| Gate | Status | Evidence / notes |
| --- | --- | --- |
| Sprint 0 records working sources, availability limits, minimum Chrome version, final permission choices | PASS (with recorded caveat) | `docs/feasibility.md` + `docs/source-matrix.md` for sources/limits; permissions in T023; minimum Chrome version decision recorded below (102 floor, validated on 153, older versions untested) |
| ≥95% eligible ready-page cases: correct title + complete/confirmed-empty description | PASS | T020: 100% titles, 100% core coverage (34/34), zero unavailable descriptions |
| Zero wrong-video, mixed-video, or fabricated original-tag results | PASS | T020: 34/34 identity matches; tags only from explicit keyword arrays; T019 A → B → A suite |
| Missing, empty, partial, errored fields follow the data contract and preserve usable metadata | PASS | Contract tests (T007/T012/T014); live partial results show 2 by-design unavailable fields |
| Live/Premiere cases and unknown content types display without invented values | PASS for live + unknown; premiere untested | One live page encountered in T020 with honest status; unknown types omitted/neutral; premiere handling inherits unknown-status behavior — not exercised live (documented limitation) |
| Drafts survive popup closure and worker restart; refresh preserves edits; reset restores source | PASS | T021 lifecycle live session; T016/T009 tests |
| Individual and full copy outputs match Section 11, including manual edits and clipboard failure behavior | PASS | Exact-output conformance tests; live full + individual copies; failure → manual-copy fallback (unit) with documented permission-override nuance |
| Character counts, token counts, keyboard controls, accessible feedback work | PASS (screen-reader audit in manual QA) | Counts live; aria labels/live regions/focus styles implemented (T018); full assistive-technology audit not performed |
| Section 37 performance targets met in a recorded production-build report | PASS | `docs/performance-report.md`: shell p95 39.6 ms, reader p95 0.2 ms, copy path ≈0.6 ms p95, no task > 0.2 ms |
| Network inspection confirms no extraction uploads or content-bearing analytics; analytics off by default | PASS | `docs/security-audit.md`: zero extension-context network requests; only the documented thumbnail image request |
| Session-data clearing works and privacy documentation matches implemented storage and telemetry behavior | PASS | Clearing live + unit (preferences kept); privacy text recorded in `docs/privacy-policy.md` (T025) matches the storage model: session-only records, local theme preference, thumbnail image request documented, no analytics |
| Store listing accurately describes shipped functionality and field availability | PASS | `docs/store-listing.md` (T025): MVP copy states extraction/edit/copy only, AI generation explicitly absent, honest field availability, no SEO/view claims; screenshots are live captures of the shipped popup |

## Decision records (architecture Section 14, updated)

| Decision | Recorded decision |
| --- | --- |
| YouTube reader sources and selectors | Closed — main-world player response is the primary source (validated live on watch + Shorts); isolated DOM candidates are fallbacks with the collapsed description excerpt explicitly never treated as complete; selectors validated against current layouts (T011/T020) |
| Minimum Chrome version | Decided: keep `102` as the documented API floor (`chrome.storage.session` availability), validated live on Chrome 153; older versions remain untested (limitation). Revisit if store analytics show older browsers |
| `clipboardWrite` | Decided: keep declared. Focused-popup writes succeed; an origin-level permission denial is overridden by the extension permission (observed live); the unfocused failure mode falls back to manual copy |
| Reader/message size limits | Provisional: 100k chars text / 1k list items / 2k item / 250k message; no measured long-description browser limit yet (T004 open) — bounds reject explicitly, never truncate |
| Retry timing and observer scope | Closed — 3 attempts / 700 ms spacing inside one 5 s deadline; navigation observer lease 120 s, one listener per signal, teardown on stop/expiry |
| Production dependency versions | Closed — locked in `package-lock.json` (React 19.3, Vite 8.3, TypeScript 6.0.3, Vitest 5, ESLint 10); unminified worker/content for verifiable bundling |

## Known limitations (documented, not release blockers)

- Logged-in pages, scheduled premieres, and age-restricted videos were not covered by the signed-out automation (T020); the data model keeps those states honest when they appear.
- A full in-popup SPA navigation run and a formal screen-reader audit belong to the manual QA pass; the underlying behaviors are unit-verified and live-observed where possible.
- Older Chrome versions below 153 are untested; the recorded floor stays at the documented API minimum.
- Long-description size limits are provisional and unmeasured in the browser.
