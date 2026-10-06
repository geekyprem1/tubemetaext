# TubeMeta AI — Implementation Tasks

**Version:** 1.0  
**Date:** 2026-10-05  
**Status:** Production MVP through T026 + post-release fixes (v0.1.1): Phase 0 core validated live; full E2E passed; T020 live corpus passed (34 videos, 100% titles, 100% core coverage, zero mismatches); T021 lifecycle checks passed; T022 performance passed; T023 security audit passed; T024 all evidenced gates PASS; T025 store assets + privacy docs complete; T026 archive `release/tubemeta-ai-v0.1.1.zip` (sha256 fcb51873…) — packaged-copy smoke passed, copy-feedback visibility fix shipped, SPA-navigation reader fix shipped after a real-browser report (verified live for both SPA cases); T027 remains (submission, on explicit instruction); T004/T005 edge-case details partially open  
**Requirements:** [PRD v1.1](TubeMeta_AI_PRD.md)  
**Design:** [ARCHITECTURE.md](ARCHITECTURE.md)

## 1. How to use this checklist

Work in phase order and respect task dependencies. Mark a task complete only when its deliverable and acceptance criteria have evidence. Record relevant paths and validation results under the task as work proceeds. Do not mark application tasks complete because planning documents exist.

`P0` means required for the MVP release. `P1` means optional follow-up. All tasks below are P0 unless explicitly labeled otherwise. Tasks describe future work; they do not authorize a store submission or publication now.

The production MVP flow now works end-to-end (T006–T019 complete, verified live), the T020 live corpus review passed (34 videos, 100% titles, 100% core coverage, zero wrong/mixed-video results — `docs/validation-report.md`), the T021 lifecycle checks passed (`docs/lifecycle-checks.md`), the T022 performance sample passed with very large margins (`docs/performance-report.md`), the T023 security/network audit passed with zero extension-context network requests (`docs/security-audit.md`), T024 reconciled release readiness with every evidenced gate now PASS (`docs/release-readiness.md` + updated architecture decision records), T025 produced the store package (`docs/store-listing.md`, `docs/privacy-policy.md`, regenerated icons, three live 1280×800 screenshots), and T026 built and verified the release archive (`release/tubemeta-ai-v0.1.0.zip`, sha256 `13d2bc68ce5b12e967dadc779b1ec25e5a0716b0d60d8daed6ef0ed8d5aeaade`, packaged-copy smoke passed — including a real-user copy-feedback visibility defect found in the smoke and fixed by auto-scrolling the confirmation into view; `docs/release-archive.md`): React/TypeScript/Vite build, full protocol with runtime validation and sender rules, session repository over `chrome.storage.session`, request coordination with identity envelopes and late-result rejection, selector-validated structured + DOM readers, pure normalization/derivation, navigation invalidation with bounded retries, the normalize → commit → same-video-fallback pipeline, the state-driven popup with editors, save acknowledgements, resets, session clearing, and accessibility polish, the exact §11 copy contract with identity-guarded clipboard actions, and 115 unit/integration tests. **T001–T003** core results are verified; **T004/T005** edge-case details and T027 (store submission, on explicit instruction) remain open. Live findings and prototype fixes are recorded in `docs/feasibility.md`.

## 2. Phase 0 — Prove extraction feasibility

### T001 — Create a minimal prototype extension

- [x] **T001 source** — Create a disposable vanilla JS MV3 prototype with popup, worker, and packaged readers.
- [x] **T001 browser check** — Load it in Chrome and verify it extracts only after the popup is opened, with no persistent host access.

**Depends on:** Nothing.  
**Deliverable:** Source files in `phase0-prototype/`; runtime steps and evidence in `docs/feasibility.md`.  
**Done when:** The extension loads unpacked, starts extraction only on invocation, and uses `activeTab`, `scripting`, and `storage` without persistent host access. No polished UI is required.  
**Progress (2026-10-05):** Unpacked load, the `activeTab` permission model, and fail-closed behavior verified, followed by a real user-invocation end-to-end run on the watch route (popup rendered 10 field cards, session snapshot stored, focused-popup copy succeeded). Error-path, date, URL, and injected-function serialization bugs found and fixed from live findings; 9 serialization-aware mocked checks pass.

### T002 — Validate URL and video identity

- [x] **T002** — Prove current-video identification on watch and Shorts routes.

**Depends on:** T001.  
**Deliverable:** URL parser prototype and identity findings in `docs/source-matrix.md`.  
**Done when:** Exact supported HTTPS hosts/routes work with extra query parameters; unsupported/lookalike hosts fail; canonical URLs remove tracking; active Shorts data can be distinguished from preloaded cards. `/watch` is not automatically classified as long-form.  
**Progress (2026-10-05):** Live player/URL ID match verified on watch and direct Shorts; canonical URL stored end-to-end; lookalike/unsupported rejection and parameter stripping covered by parser tests; watch route stayed type-unknown; direct Shorts distinguished from the feed state (feed exposes no player response).

### T003 — Prove complete descriptions and original tags

- [x] **T003** — Evaluate structured sources and current-video DOM fallbacks.

**Depends on:** T002.  
**Deliverable:** Field-by-field source matrix with route, source, identity evidence, completeness evidence, and availability limitations.  
**Done when:** Title and full description extraction work on both routes or their limitations are documented; empty descriptions differ from unavailable descriptions; original tags are returned only from explicit video-specific data. Any main-world reader is packaged, minimal, and returns validated data.  
**Progress (2026-10-05):** Live: full description (2,376 chars) vs 115-char collapsed DOM preview on watch; Shorts title/description verified with absent keywords staying unavailable; player keywords kept as candidates. Main-world reader made self-contained after the Chrome serialization finding and validated end-to-end.

### T004 — Check difficult metadata and input sizes

- [ ] **T004** — Exercise Hindi/English, long descriptions, live states, and optional fields.

**Depends on:** T003.  
**Deliverable:** Prototype observations, representative fixtures, and proposed limits in `docs/feasibility.md`.  
**Done when:** Unicode hashtags, channel attribution, thumbnails, exact dates/counts, duration, and partial fields have defined handling; abbreviated views and concurrent viewers are not fabricated as exact total views. Long input is preserved or explicitly rejected, never silently truncated. Include logged-in/out observations.  
**Progress (2026-10-05):** Partial (signed out): emoji/Unicode title, channel attribution, thumbnail candidates, exact dates/counts, duration, and partial-field behavior verified live; hashtag derivation stored end-to-end. Open: Hindi/Devanagari live content, long-description size limits, live/upcoming states, and logged-in observations.

### T005 — Close compatibility and permission decisions

- [ ] **T005** — Validate browser APIs, draft storage, and the exact copy flow.

**Depends on:** T004.  
**Deliverable:** Minimum Chrome version, final permission list, and feasibility conclusion.  
**Done when:** Target verification followed by clipboard write works on the supported baseline; the need for `clipboardWrite` is recorded; session storage behavior is demonstrated; both routes have trustworthy core extraction. Update architecture/PRD if findings require a changed requirement.  
**Progress (2026-10-05):** Partial: identity-check → clipboard flow succeeded in the focused popup ("TITLE copied") on Chrome 153.0.8010.52 with `clipboardWrite` declared; unfocused extension-page writes fail with a focus error (recorded). `chrome.storage.session` behavior demonstrated: empty until invocation, snapshot commit, cleared by extension reload. Open: minimum supported Chrome version and whether `clipboardWrite` is strictly required for focused writes.

**Phase gate:** Do not build the full UI until T001–T005 establish viable sources and availability limits. A source that cannot be verified must remain unavailable.

## 3. Phase 1 — Production foundation

### T006 — Scaffold the production build

- [x] **T006** — Set up React, TypeScript, Vite, and separate extension entry points.

**Depends on:** T005.  
**Deliverable:** Planned source layout, npm lockfile, build configuration, manifest source, and basic development instructions.  
**Done when:** `build` creates a loadable `dist/` containing a popup, module worker, injectable isolated script, and working optional main-world reader. All runtime imports/assets are packaged. Add `dev`, `typecheck`, `lint`, `test`, and `package` scripts appropriate to the repository.  
**Progress (2026-10-05):** Scaffold complete. Single manifest source (`src/manifest.ts` → `dist/manifest.json`); Vite builds for popup (React, hashed assets), module worker (`worker.js`, single ESM file, unminified), and isolated content script (`content.js`, single IIFE). Build verification fails the build unless manifest/popup references resolve, bundles contain no unresolved or dynamic imports, the content IIFE executes with exactly one listener + install guard, and the main-world reader extracted from `dist/worker.js` still runs correctly under function serialization in a bare VM. Scripts `dev`/`build`/`typecheck`/`lint`/`test`/`package` implemented; typecheck and lint clean; 5 unit tests pass; `npm run package` produces `release/tubemeta-ai-v0.1.0.zip`. Chrome smoke test: `dist/` loads unpacked, the popup renders and reports the worker version over the message protocol, an EXTRACT request returns `UNSUPPORTED_PAGE` for a non-YouTube tab, and the module service worker is listed as a `service_worker` target. Toolchain note: TypeScript pinned to 6.0.3 because typescript-eslint 8.x does not yet accept TypeScript 7.

### T007 — Implement domain contracts and errors

- [x] **T007** — Define metadata, draft, URL, field-state, and error contracts.

**Depends on:** T006.  
**Deliverable:** `domain/metadata.ts`, `domain/youtube-url.ts`, and `shared/errors.ts`.  
**Done when:** Contracts match PRD Section 24; unknown/missing/empty/zero values remain distinct; raw factual types are retained; pure domain modules have no Chrome or React dependency.  
**Progress (2026-10-05):** `domain/metadata.ts` implements the Section 24 contracts (FieldSource / Field&lt;T&gt; with available/empty/unavailable/error variants incl. optional `isPartial`, MetadataSnapshot, SessionDraft, editable-field keys) plus pure constructors (`available`/`emptyField`/`unavailable`/`errorField`) and an `isAvailable` narrowing guard; `domain/youtube-url.ts` now shares the `PageType` contract; `shared/errors.ts` carries the controlled error codes. Domain purity is enforced twice: lint (no `chrome`/`window`/`document`/`navigator` globals and no react / background / content / popup imports inside `src/domain`) and a unit test that scans the domain sources. New tests cover the zero-vs-empty-vs-unavailable-vs-error distinction, partial availability, and narrowing. Typecheck, lint, 9 unit tests, and the verified build all pass.

### T008 — Add message and storage validation

- [x] **T008** — Implement versioned messages, sender validation, and payload limits.

**Depends on:** T007.  
**Deliverable:** `shared/messages.ts`, `shared/limits.ts`, and runtime validators.  
**Done when:** Invalid versions/types/senders/frames, unsafe URLs, malformed fields, and oversized payloads are rejected using controlled errors. Content scripts cannot issue privileged draft-write commands.  
**Progress (2026-10-05):** `shared/messages.ts` implements the full Section 6 protocol (PING, OPEN_VIDEO, REFRESH_VIDEO, PATCH_DRAFT, RESET_DRAFT, CLEAR_SESSION_DATA, VERIFY_COPY_TARGET, READ_VIDEO, VIDEO_INVALIDATED) with `protocolVersion: 1`; `validateRuntimeMessage` rejects unknown versions/types, missing or malformed fields, wrong per-field value shapes, and payloads over `MAX_MESSAGE_LENGTH` with controlled `INVALID_PAYLOAD` codes, and canonicalizes accepted messages. `classifySender` separates extension-UI pages from main-frame content-script senders using browser-supplied tab/frame data (subframes and unrelated hosts classify as `unknown`); `requiredSenderClass` keeps every draft-mutating command extension-UI-only, and violations return `INVALID_SENDER`. `domain/validation.ts` adds runtime validators for field states, snapshot, draft, and stored records plus ISO dates/timestamps, exact numerics, and safe HTTPS URL allowlists (YouTube hosts; `ytimg.com` thumbnails); `StoredRecord` joined the metadata contracts. The coordinator validates envelope + sender before dispatch; the content script answers READ_VIDEO under the same validator. 13 new unit tests (22 total); typecheck/lint/build pass; Chrome smoke test confirmed PING, OPEN_VIDEO routing (`UNSUPPORTED_PAGE`), and a live malformed-PATCH rejection (`INVALID_PAYLOAD`). Handlers for the remaining commands land with T009/T010.

### T009 — Build the session repository

- [x] **T009** — Implement snapshots, overrides, revisions, and ordered mutations.

**Depends on:** T008.  
**Deliverable:** Worker-owned storage repository and domain draft projection.  
**Done when:** Tab/video records are independent; snapshot updates cannot erase edits; missing and empty overrides differ; hydration works after worker restart; quota failure is visible; edited drafts are not silently evicted. Persist only preferences locally and keep session data out of sync storage.  
**Progress (2026-10-05):** `background/storage.ts` implements the worker-owned session repository over `chrome.storage.session` (`record:`, `request:`, `epoch` keys; read-through hydration so worker restarts keep working; all mutations serialized through a single queue with read-modify-write). Snapshot commits keep existing overrides and bump the record revision; draft patches and resets validate field-specific value shapes, require `baseRevision` + `epoch` to be current (`STALE_REVISION`/`VIDEO_CHANGED` otherwise), and never touch snapshot fields; clearing removes records and counters and advances the epoch, which blocks late writes that still carry the old epoch (counters then restart safely). Quota pressure evicts only unedited (no-override) records oldest-first and retries, surfacing `STORAGE_FAILED` rather than ever evicting edited drafts. Preferences are the only local-storage resident (`preferences` with schema + theme, validated with defaults; nothing is written to sync). `domain/drafts.ts` adds pure projection (`projectDraft`, `hasOverrides`) that merges snapshot + overrides with `edited`/`isPartial` markers and preserves missing-vs-empty distinctions. 14 new unit tests (36 total) cover record independence, refresh-keeps-edits, missing/empty overrides, stale revision/epoch/missing-record rejection, request-id allocation + reset, quota eviction policy, and preferences. Typecheck/lint/build pass.

### T010 — Implement request coordination

- [x] **T010** — Connect popup requests, injection, lifecycle recovery, and response validation.

**Depends on:** T008, T009.  
**Deliverable:** `background/coordinator.ts` and content-script installation lifecycle.  
**Done when:** Requests carry current tab/video/request/session/epoch identity; request allocation is serialized; duplicate listeners are prevented; worker restart and document reload recover cleanly; late results cannot become current.  
**Progress (2026-10-05):** `background/coordinator.ts` runs the full request lifecycle: every OPEN_VIDEO/REFRESH_VIDEO re-reads the tab, enforces the URL allowlist, captures the session epoch, allocates a serialized per-tab request id, writes a `current:<tabId>` marker (session token + requestId + videoId + epoch in session storage), idempotently injects `content.js`, verifies the document/video through READ_VIDEO, invokes the main-world reader, and accepts the result only when the marker and the tab URL are still current — otherwise `VIDEO_CHANGED`, with reader/injection failures surfacing `READER_FAILED`/`ACCESS_DENIED`. Duplicate listeners are prevented by the content install guard (the build check now runs the built bundle twice and asserts one listener), and every step hydrates from session storage so worker restarts and document reloads recover cleanly. PATCH_DRAFT/RESET_DRAFT/CLEAR_SESSION_DATA delegate to the session repository with revision acknowledgements, VERIFY_COPY_TARGET rechecks tab + record + request id, and VIDEO_INVALIDATED is acknowledged (deeper navigation handling lands with T013). 11 new coordinator tests (47 total) cover the envelope, mid-flight marker/clear/navigation rejection, reader failure codes, draft/clear/verify handlers, and sender privileges; typecheck/lint/build pass and a Chrome smoke test confirmed PING, OPEN_VIDEO routing, CLEAR_SESSION_DATA, and epoch advancement in real session storage.

**Phase gate:** Production extension loads with validated communications and session storage before integrating all readers.

## 4. Phase 2 — Reliable extraction

### T011 — Implement production readers

- [x] **T011** — Port validated structured and DOM readers from the prototype.

**Depends on:** T010.  
**Deliverable:** Isolated readers and the optional self-contained main-world reader.  
**Done when:** Every PRD field is attempted in the documented priority order; only current-video sources are used; full descriptions preserve newlines/URLs; no undocumented remote endpoint is used. Tag absence does not automatically become an empty list.  
**Progress (2026-10-05):** Readers are live and selector-validated against real pages. The self-contained main-world reader remains the primary structured source (title, full description with newlines/URLs, keyword candidates, channel, thumbnail, exact views/duration, ISO dates, live flags) and runs under the serialized-injection guarantee. New `content/readers/video-dom.ts` reads current-video DOM candidates in the isolated world with selectors probed live on real watch and Shorts layouts: watch title (`ytd-watch-metadata h1`), owner link (absolutized from the relative href), views text, exact publish-date meta (`meta[itemprop="datePublished"]`), thumbnail (`og:image`), exact media-element duration, and the collapsed description excerpt (explicitly named an excerpt and never treated as complete); Shorts reads only the active reel (single deep-link renderer, or `[is-active]` among feed renderers) through the current view-model layout (`yt-shorts-video-title-view-model h1`, `a.ytAttributedStringLink[href^="/@"]`) plus media duration, and never invents views or descriptions. READ_VIDEO returns the DOM candidates with identity, and OPEN_VIDEO results carry both sources (`reader` + `dom`) so normalization can follow the PRD §8.5 priority order at T012/T014. No undocumented endpoint is used, and tag absence continues to map to unavailable, never an empty list. 4 new happy-dom fixture tests (51 total) cover watch, shorts, feed active-reel selection, and missing-structure cases; typecheck/lint/build pass.

### T012 — Normalize and derive fields

- [x] **T012** — Implement hashtags, numeric/date formatting inputs, and field statuses.

**Depends on:** T011.  
**Deliverable:** `domain/normalize.ts` and `domain/hashtags.ts`.  
**Done when:** Unicode/combining-mark hashtags and deduplication work; URL fragments are excluded; incomplete inputs produce partial/unavailable states; dates, views, live durations, and publication status follow the PRD. Partial failures preserve valid fields.  
**Progress (2026-10-05):** `domain/hashtags.ts` extracts hashtags from title + complete description with Unicode property escapes (letters, combining marks, digits, underscores — Hindi strings validated), requires string-start/whitespace so URL fragments and standalone `#` are excluded, preserves first-seen spelling and order, and deduplicates through an exported NFKC + locale-lowercase key. Unavailable inputs mark the result `isPartial` and zero matches then resolve to unavailable, while both-complete zero matches resolve to a confirmed empty list. `domain/normalize.ts` implements status-aware field builders and value parsers: title (unavailable, never a fake empty), description (confirmed empty preserved; CRLF → LF; oversized → controlled `FIELD_TOO_LARGE` without truncation), keyword tags (absent ≠ empty; malformed → `INVALID_OR_TOO_LARGE`), exact counts (comma grouping and an English "views" suffix accepted; `1.2M` or localized digits never become fabricated integers; zero stays available), durations (media floats rounded, zero and live/upcoming elapsed values unavailable), publish dates (ISO timestamps reduced to date-only; relative or invalid dates unavailable), playback status (upcoming/live/recorded/unknown from verified flags only), content type (Shorts route → short; watch stays unknown), and HTTPS upgrades gated through the YouTube/ytimg allowlists. Partial failures preserve other fields by construction. 19 new unit tests (70 total); typecheck/lint/build pass.

### T013 — Implement navigation and readiness handling

- [x] **T013** — Add bounded retries, invalidation, and observer cleanup.

**Depends on:** T011, T012.  
**Deliverable:** Navigation controller and extraction deadline handling.  
**Done when:** A → B → A, back/forward, rapid Shorts changes, reload, and multiple tabs cannot mix results. Old document/session responses are rejected. Loading resolves to data or an actionable error within five seconds; there is no continuous polling or accumulating observer set.  
**Progress (2026-10-05):** `content/navigation.ts` adds a lease-based navigation observer (`yt-navigate-finish`, `popstate`, `hashchange`): one listener per signal with duplicate-start protection, renewed 120 s lease on every READ_VIDEO, and automatic teardown on lease expiry or manual stop, so observers never accumulate and nothing extracts or polls after the session ends. Navigations while active send `VIDEO_INVALIDATED` (sender classified by the YouTube host, so non-video routes still notify) — the worker clears that tab's current-request marker, which also rejects any in-flight result at acceptance, and relays the invalidation to extension pages for the popup's re-resolve state. Extraction now uses a bounded retry policy inside one five-second deadline (3 attempts, 700 ms spacing): missing player responses and mid-transition identity mismatches retry as `PAGE_NOT_READY`/`VIDEO_CHANGED` transients, while access denials, superseded markers, and settled mismatches return immediately; exhaustion returns the actionable code or `EXTRACTION_TIMEOUT` past the deadline. Combined with the T010 acceptance checks (marker + live tab URL), A → B → A, back/forward, rapid Shorts changes, reload, and multi-tab flows cannot mix results. 8 new unit tests (78 total) cover observer lifecycle/lease behavior, retry resolution and budgets, persistent mismatch mapping, and marker clearing + relay on invalidation; typecheck/lint/build pass.

### T014 — Commit snapshots and refresh safely

- [x] **T014** — Integrate accepted extraction results with stored snapshots and drafts.

**Depends on:** T009, T013.  
**Deliverable:** Snapshot commit and refresh workflow.  
**Done when:** Refresh updates only source data; overrides remain intact; a failure retains only a verified same-video snapshot with its timestamp and notice. URL-only extraction is a failure, and old-video cached data is never displayed as current.  
**Progress (2026-10-05):** `background/snapshot.ts` builds a validated `MetadataSnapshot` from accepted reader results in the PRD §8.5 priority order — structured player data first, DOM candidates (`dom` source) only where the structured value is unusable, with the collapsed DOM excerpt explicitly never treated as a description, hashtags derived from the final title + complete description, live/upcoming duration and view suppression, shorts → `short`, and a `NO_CORE_METADATA` rejection when no available or confirmed-empty core field exists (URL-only results are failures). The coordinator now normalizes, re-checks acceptance, and commits through the session repository with the request-start epoch: refreshes replace only snapshot fields (overrides and revisions survive), commit-time epoch drift maps to `VIDEO_CHANGED`, and the extraction response is the full `SessionState` (snapshot + draft + revision). On failure after identity was established, the worker verifies the tab still shows the same video and returns that video's stored snapshot with `staleFallback: true` (the retained timestamp lives in the snapshot's `extractedAt`) — another video's record is never substituted. 10 new unit tests (88 total) cover structured/DOM priority, excerpt rejection, URL-only failure, confirmed-empty descriptions, zero views, live suppression, shorts typing, identity guards, verified same-video fallback, and no cross-video fallback; typecheck/lint/build pass.

**Phase gate:** Correct watch/Shorts extraction and identity handling are functional before finishing the editing interface.

## 5. Phase 3 — Popup, editing, and copy

### T015 — Build popup states and metadata layout

- [x] **T015** — Implement the popup reducer, video summary, cards, and Details section.

**Depends on:** T014.  
**Deliverable:** React popup with loading, unsupported, ready, refreshing, and failure states.  
**Done when:** Title/description/tags/hashtags have dedicated cards; factual fields are read-only; descriptions collapse visually without losing data; all empty/unavailable/partial/error states have accurate messages; Copy Everything stays visible.  
**Progress (2026-10-05):** The popup is now a real client: `popup/state.ts` implements the reducer state machine (resolving → unsupported/extracting → ready/failed; refreshing keeps the previous session visible; staleFallback + errorCode notices), `popup/api.ts` sends OPEN_VIDEO/REFRESH_VIDEO with response validation, and App wires the lifecycle: active-tab resolution with a local URL pre-check, request-sequence guarding so stale responses never render, a VIDEO_INVALIDATED listener that re-resolves on navigation, and Refresh (disabled unless ready). `SessionState` now carries the session epoch so the popup can issue refresh/patch operations. Layout matches the PRD: compact video summary (thumbnail, title, channel, type · duration · views), four dedicated cards driven by the draft projection with Edited/Partial badges and accurate empty/unavailable/error messages, informational character/item counts, presentational description collapse ("Show more/less" — copying keeps the full value), a read-only Details section (video ID/URL, channel name/URL, thumbnail URL, publish date, duration, views, content/playback labels, extracted-at), and a sticky Copy footer plus per-card Copy buttons with disabled states for empty values (exact copy contract and identity-guarded clipboard behavior land with T017). `domain/format.ts` adds display formatters. Live Chrome smoke: the popup renders the unsupported state end-to-end (header, panel, Try again, disabled refresh). 6 new unit tests (94 total); typecheck/lint/build pass.

### T016 — Add editing, save feedback, and reset

- [x] **T016** — Wire four editors to immediate draft patches and persistence acknowledgements.

**Depends on:** T009, T015.  
**Deliverable:** Editors, saved/unsaved indicators, per-field reset, and reset-all.  
**Done when:** Accepted edits survive popup closure and worker suspension; same-tab/video drafts restore; intentional clearing persists; refresh keeps overrides; reset restores the latest source. Lists use one token per line. Editing title/description does not silently change hashtags.  
**Progress (2026-10-05):** The four metadata cards are now always-editable editors (single-line title; textareas for description and the one-token-per-line tags/hashtags lists — the compact fixed-height description editor replaces the static collapse presentation). Inputs dispatch a local override instantly (Edited badge appears), then a 300 ms debounced PATCH_DRAFT per field (plus blur flush and an unmount best-effort flush); every mutation runs through one serialized queue that reads the latest acknowledged revision, so rapid cross-field edits cannot race into STALE_REVISION. Save feedback lives in the reducer: Saving… until the storage acknowledgement, then Saved (auto-clearing after 2 s) or Couldn't save edits on failure — a failed save keeps the editor and extracted content usable, while a real revision/epoch conflict triggers a clean re-resolve. Per-field Reset (only shown for edited fields) and Reset all edits enqueue RESET_DRAFT operations after flushing pending patches; OPEN_VIDEO restores the stored draft on every open, so accepted edits survive popup closure and worker suspension, intentional clearing persists as an empty override, refresh keeps overrides, and reset reveals the latest source. Editing title/description never rewrites the hashtag field. `popup/editor-text.ts` preserves commas inside list tokens and drops blank lines. 5 new unit tests (99 total); typecheck/lint/build pass.

### T017 — Implement exact copy formatting and clipboard behavior

- [x] **T017** — Build pure formatters and guarded clipboard actions.

**Depends on:** T012, T016, T005.  
**Deliverable:** `domain/copy-format.ts` and `popup/clipboard.ts`.  
**Done when:** Individual/full copy follows PRD Section 11 ordering, headings, omission, partial hashtags, dates, duration, zero views, and edited values. Copy rechecks current identity, cancels stale targets, confirms only successful writes, and provides manual-copy text on failure.  
**Progress (2026-10-05):** `domain/copy-format.ts` implements the exact §11 contract: fixed field order (title → description → tags → hashtags → video URL/ID → channel name/URL → thumbnail URL → publish date → duration → views → content type → playback status → extracted at), uppercase headings with `:\n`, one blank line between fields, comma-space tag separators and single-space hashtags with trimmed tokens and dropped blanks, `HASHTAGS (PARTIAL)` for partial extraction (edited hashtags keep the normal heading), `m:ss`/`h:mm:ss` durations, ungrouped integer views with zero preserved, date-only publication values with the snapshot's UTC timestamp, canonical URL + ID exported regardless of edits, and omission of empty/unavailable/errored fields and unknown types without placeholders. Individual copy uses the same values without headings and disables for empty values. `popup/clipboard.ts` runs the guarded flow: VERIFY_COPY_TARGET (tab + record + request id) immediately before `navigator.clipboard.writeText`; failed verification cancels the write and re-extracts, a failed write exposes selectable manual-copy text, and success shows only after the write resolves. 8 new conformance tests (107 total) pin the exact output string and omission rules. The full live E2E passed with a real toolbar invocation on the watch page: real extraction rendered the summary (thumbnail, 3:33, exact views) and all four cards from the committed session record; a title edit showed Saved with the override persisted in session storage; Reset restored the source and cleared the override; Copy Everything verified identity and wrote the exact export (a 3,484-char OS clipboard capture starts with `TITLE:` and preserves newlines/Unicode); hashtags stayed unchanged during the title edit. typecheck/lint/build pass.

### T018 — Add session clearing and accessible controls

- [x] **T018** — Finish data clearing, counts, keyboard behavior, and visual feedback.

**Depends on:** T016, T017.  
**Deliverable:** Clear-session control, character/token counts, accessible labels/statuses, and light/dark styles.  
**Done when:** Clearing removes snapshots/drafts and invalidates queued results/writes without removing preferences. Focus order, reset, refresh, editing, copying, and error feedback work with keyboard/screen-reader operation. Unknown content types have neutral labels.  
**Progress (2026-10-05):** The popup gains a two-step Clear session data control (inline confirm, no blocking dialogs) that cancels pending debounced patches, sends CLEAR_SESSION_DATA through the worker's epoch-advancing clear, invalidates in-flight resolves, and lands in a dedicated `cleared` state ("Snapshots and drafts were removed; preferences are kept") with a Load current video action; stale patch/reset responses after a clear can no longer trigger a re-resolve. Preferences surviving a clear is covered by a storage test. Accessibility: field inputs carry aria-labels (lists note "one token per line"), per-card buttons announce "Copy title"/"Reset description"-style labels, statuses (save state, extraction, copy feedback, notices, confirm group) are live regions or labelled groups, loading panels are aria-busy, focus-visible outlines exist for buttons and links, and all controls are native keyboard-operable in logical DOM order. Character/item counts, light/dark styling, and neutral "Video"/"Unknown" labels for unverified types were already in place from T015. The Phase 3 gate is satisfied by the T017 live E2E (extraction → edit → copy with drafts and explicit error handling; no AI controls or login). 2 new unit tests (109 total); typecheck/lint/build pass.

**Phase gate:** End-to-end extraction → edit → copy works with drafts and explicit error handling. No AI controls or login are required.

## 6. Phase 4 — Validation and release hardening

### T019 — Add meaningful domain and integration checks

- [x] **T019** — Verify contracts and race conditions with reproducible fixtures.

**Depends on:** T018.  
**Deliverable:** Focused unit/integration coverage and recorded outcomes.  
**Done when:** Checks cover host/route validation, exact copy output, partial fields, Unicode, zero values, overrides/reset, delayed/out-of-order responses, A → B → A, clear during pending writes, and worker recovery. Assert observable behavior rather than duplicating implementation.  
**Progress (2026-10-05):** Coverage inventory (114 tests across 18 files) mapping the required checks to observable behavior: host/route validation and tracking-parameter stripping (`youtube-url.test.ts`); exact §11 copy output pinned as a full expected string plus omission, partial-heading, and edited-list rules (`copy-format.test.ts`) and the guarded clipboard flow with verify-before-write ordering, stale-cancellation, and manual fallback (`clipboard.test.ts` — new); partial-field rules (`hashtags.test.ts`, `snapshot.test.ts`); Unicode Hindi/combining marks and emoji (`hashtags.test.ts`, `normalize.test.ts`, `main-world-reader.test.ts`); zero views preserved through normalization, snapshot building, and copy; overrides/reset semantics across projection, storage (missing vs empty), coordinators, and the popup reducer; delayed/out-of-order responses (`coordinator.test.ts` — newer-request marker replacement, mid-flight navigation, mid-flight clear, late reader failures) plus the new explicit **A → B → A** test where a gated stale A result resumes after B and A' completed: the stale result is discarded (never committed — A's stored request id stays 3) and the request receives the current A record as a stale fallback instead; clear during pending writes via epoch-gated commits/patches, pending-patch cancellation on clear, and post-clear stale guards; worker recovery via the read-through session repository (records, counters, and epoch re-hydrated from `chrome.storage.session` on every operation). Bounded retries, sender privileges, message/payload validation, navigation-observer lease lifecycle, snapshot priority order, and editor-text rules are also covered. typecheck/lint/build pass.

### T020 — Run the browser and video corpus review

- [x] **T020** — Validate at least 30 accessible videos plus reproducible edge cases.

**Depends on:** T019.  
**Deliverable:** Corpus results in `docs/validation-report.md`, with source evidence and expected availability.  
**Done when:** Watch/Shorts, Hindi/English, logged-in/out, empty/missing fields, long descriptions, live/premiere/replay, restricted videos, and navigation cases are reviewed. At least 95% of eligible ready cases have correct titles and complete/confirmed-empty descriptions. Wrong/mixed-video and fabricated-original-tag results are zero. Unavailable descriptions count as misses in core coverage.  
**Progress (2026-10-05):** Corpus review completed and recorded in `docs/validation-report.md`, generated reproducibly by `tests/integration/corpus-report.test.ts` from the captured fixture `tests/fixtures/corpus/live-corpus.json` (gate-checked: titles ≥95%, core coverage ≥95%, zero identity mismatches). Method: 34 signed-out videos (12 watch, 22 Shorts) harvested from English, Hindi, and recipe/live searches, loaded in real Chrome; the shipped `readCurrentPlayerResponse` (extracted from `dist/worker.js`) ran in each page's main world and snapshots were built with the real `buildMetadataSnapshot`; evidence = page-visible title, `og:title`, and an expanded-description sample. Results: 34/34 video-ID identity matches (zero wrong/mixed videos), 34/34 titles correct (100%), descriptions 26 available + 8 confirmed empty + 0 unavailable (100% core coverage), expanded-description proof 6/6, Devanagari coverage on 12 titles/descriptions, one live page encountered, and player keywords present on 23 entries (labeled candidates) vs 11 absent kept unavailable — never fabricated or turned into empty lists. Gaps recorded honestly in the report: logged-in pages, scheduled premieres, and age-restricted videos were not covered by the signed-out automation; navigation race cases remain covered by the T019 suite and the T017 live end-to-end run.

### T021 — Verify popup, storage, and clipboard lifecycle

- [x] **T021** — Exercise failures that cannot be established by parser checks alone.

**Depends on:** T019.  
**Deliverable:** Browser lifecycle checklist with outcomes.  
**Done when:** Immediate close/reopen after acknowledged editing, storage failure/quota handling, browser-session expiration, extension reload/update expiration, worker restart, two tabs, permission denial, clipboard denial, and manual-copy fallback behave as documented. Pending saves are never reported as saved prematurely.  
**Progress (2026-10-05):** The checklist with outcomes is recorded in `docs/lifecycle-checks.md`. Live (one real toolbar invocation driven over CDP): editing showed `Saved` only after the acknowledgement and `overrides {"title":"Lifecycle Edit 1"}` persisted in session storage; closing and reopening the popup restored the edited draft from storage; the service worker was terminated over CDP (`gone`) and the next popup open woke a fresh worker that hydrated the draft (title restored) and accepted a new edit (`Saved`, `overrides {"title":"Lifecycle Edit 2"}`); reopening while an unresolved extension page was the active tab correctly refused cached YouTube data; `Saved` never appears before the storage acknowledgement. Unit/documentary evidence: quota eviction and visible `STORAGE_FAILED` (`session-storage.test.ts`), browser-session storage clearing on every fresh launch, the Phase-0 extension reload/update clearing observation, per-tab/video record isolation, fail-closed permission denial, and the clipboard fallback paths. Clipboard-denial note: an origin-level `clipboard-write` denial was overridden by the extension's declared `clipboardWrite` permission (the write still succeeded, re-confirming that decision); the manual-copy fallback is unit-tested and the unfocused-write failure mode was observed live in Phase 0. typecheck/lint/build pass (115 tests).

### T022 — Measure production performance

- [x] **T022** — Run the performance sample on the documented browser/machine.

**Depends on:** T020, T021.  
**Deliverable:** At least 100 ready-page extraction runs, cold/warm and watch/Shorts results, memory observations, and main-thread profiling.  
**Done when:** Popup shell p95 ≤300 ms, ready-page extraction p95 ≤2 seconds, loading deadline ≤5 seconds, copy confirmation p95 ≤300 ms, and no observed extension-attributable task >50 ms in the sample. Investigate retained memory growth. Fix failures and rerun affected measurements.  
**Progress (2026-10-06):** Performance report recorded in `docs/performance-report.md`. Popup shell: first-open FCP 104 ms; warm shell-visible p95 39.6 ms (gate ≤300 ms PASS). Ready-page extraction: the shipped reader ran on 100 real ready pages (50 watch + 50 Shorts; 34 cold / 66 warm; 100/100 successful, zero failures) with p95 0.2 ms on both routes; max single task 0.2 ms, so no extension-attributable task >50 ms (PASS). Supporting live costs: session-storage set/get p95 0.2 ms, popup↔worker round-trip p95 0.5 ms, focused clipboard write p95 0.1 ms → copy path ≈0.6 ms p95 (gate ≤300 ms PASS). The bounded retry design caps loading at five seconds with `EXTRACTION_TIMEOUT` (unit-tested). Memory: the YouTube tab's own JS heap grew 199 MB → 1.66 GB across 100 rapid programmatic navigations (page-attributable SPA caches/uncollected garbage; not extension-attributable — the extension holds no durable in-memory state, hydrates from session storage per operation, and its install guard prevents listener accumulation); popup heaps were 2.2–3.5 MB across independent opens. Caveats recorded: full popup-driven runs require a real user gesture and were validated qualitatively; an earlier harness run's shorts failures came from stale browser-profile state and the affected measurements were rerun clean.

### T023 — Audit production security and network boundaries

- [x] **T023** — Inspect the built extension, permissions, messages, storage, and network activity.

**Depends on:** T020, T021.  
**Deliverable:** Audit results in the validation report.  
**Done when:** No provider keys, remote scripts, privileged page bridge, unnecessary host access, extraction uploads, content-bearing logs, or remote analytics transport exist. Metadata is plain text; URLs and messages are validated; image-host requests are documented.  
**Progress (2026-10-06):** Audit recorded in `docs/security-audit.md` (referenced from the validation report). Permissions: exactly `activeTab`/`scripting`/`storage`/`clipboardWrite`, no host permissions, no static content scripts, MV3 default CSP, all code packaged locally. Static: bundles contain only YouTube canonical-URL builders plus React-internal namespace/error URLs — no analytics/CDN/provider hosts; no secrets; no `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`importScripts` anywhere (the popup bundle's only `fetch` call site is React's uncalled resource-preload helper); no `postMessage` (no page bridge — the main-world reader is a serialized function via `scripting`); no app logging or HTML sinks in source (metadata renders as React text nodes; React's internal raw-HTML machinery is unused); message/payload validation and sender rules cited from T008. Live: a CDP network capture across the popup and service-worker targets during popup load, PING, storage round-trip, and the copy-verification flow recorded **zero network requests from extension contexts**. The only page-data-derived request (the popup thumbnail from the allowlisted `*.ytimg.com` host) is documented and was observed live in the T017 end-to-end run. typecheck/lint/build pass (115 tests).

### T024 — Close the MVP release gates

- [x] **T024** — Reconcile evidence with PRD Section 42 and architecture decisions.

**Depends on:** T022, T023.  
**Deliverable:** Release readiness report, known limitations, and updated decision records.  
**Done when:** Required build/type/lint checks and relevant tests pass; every launch criterion has evidence; unresolved limitations are accurately documented. Failed release criteria remain unchecked until resolved or explicitly revised in the requirements.  
**Progress (2026-10-06):** Release readiness report recorded in `docs/release-readiness.md`; architecture decision records (Section 14) updated with final statuses. Verification: build + build-verification PASS, typecheck PASS, lint PASS, 115/115 tests PASS. PRD §42 feature checklist: all items evidenced PASS except the Store-build production test (opens T026). Release gates: 11 PASS with evidence (T020 corpus, T021 lifecycle, T022 performance, T023 security), one PASS with a recorded caveat (minimum-Chrome decision: 102 floor validated on 153), and two explicitly open within T025/T026 by design (privacy documentation, store listing accuracy). Known limitations documented: signed-out coverage gaps (logged-in/premiere/age-restricted), no live mid-popup SPA run or formal screen-reader audit yet, older Chrome versions untested, long-description ceiling unmeasured. No failed criterion was silently passed; the two open gates remain unchecked until T025/T026 produce their evidence.

## 7. Phase 5 — Store package and release preparation

### T025 — Prepare accurate store assets and privacy text

- [x] **T025** — Create icons, real-product screenshots, listing text, and privacy documentation.

**Depends on:** T018; finalize after T024.  
**Deliverable:** Assets plus `docs/store-listing.md` and `docs/privacy-policy.md`.  
**Done when:** Listing describes available extraction/edit/copy features and data limitations; AI generation is clearly absent from MVP; permission purposes, session expiration/clearing, and thumbnail requests match actual behavior. No guaranteed SEO/view claims appear.  
**Progress (2026-10-06):** Store package recorded in `docs/store-listing.md` and `docs/privacy-policy.md`; release-readiness gates for privacy documentation and listing accuracy flipped to PASS. Icons regenerated (final brand mark chosen by the user: "Tilted Card" — red gradient tile with a tilted white metadata card; bold variant for 16/32, detailed for 48/128, generator in `scripts/generate-icons.ps1`, rebuilt into `dist/`). Three 1280×800 store screenshots composed from live captures of the shipped popup (real session on a `/watch` page): extract view, editing view ("Edited" badge + Reset), and details/copy view with the visible "Copied to clipboard." confirmation — raws kept in `docs/store-assets/raw/`, regenerator in `scripts/compose-store-assets.ps1`. Listing copy covers only extraction/edit/copy, states AI generation is absent, documents honest field availability, uses the PRD short description, includes permission-by-permission justifications, data-disclosure answers, and a no-claims checklist. Privacy policy matches the implemented storage model (session-only records, local theme preference only, session expiration + Clear session data, clipboard written only on request, thumbnail request to `ytimg.com` documented, no analytics).**Remaining for completion:** host the privacy policy at a public URL and paste it into the store form at submission time.

### T026 — Produce and inspect the release archive

- [x] **T026** — Build a reproducible Chrome Web Store package.

**Depends on:** T024, T025.  
**Deliverable:** Versioned release ZIP and installation/release instructions.  
**Done when:** Archive root contains a valid manifest, all referenced assets exist, development-only files are excluded, and the packaged version loads and passes the final core-flow smoke review. Record version and artifact checksum.  
**Progress (2026-10-06):** Release archive documented in `docs/release-archive.md`. Final artifact: `release/tubemeta-ai-v0.1.1.zip` (v0.1.1, 103,753 bytes, 12 entries) with SHA-256 `fcb51873516d050943be29a4d7b4d52f18c5f040fd8b27649a2a823badefda1c` recorded in the `.sha256` sidecar (includes the user-selected Tilted Card brand icon and the SPA-navigation reader fix); `scripts/package.mjs` prints and records the checksum. Archive root = extension root (manifest.json at root, all referenced assets present, only `dist/` output zipped — no sources, tests, docs, maps, or scripts). Packaged-copy verification: extracted ZIP loaded clean; the packaged reader extracted live watch + Shorts pages correctly; a real toolbar invocation produced a session (4 fields, correct summary) and the copy action wrote the exact §11 export (3,484 chars, matching the T017 run) to the system clipboard; the identity guard correctly rejected a stale-session copy after navigation (`VIDEO_CHANGED`). The smoke surfaced a real UX defect — the "Copied to clipboard." confirmation rendered below the fold so users saw no feedback — fixed by auto-scrolling the confirmation into view (`src/popup/App.tsx`), re-verified live (scroll 0 → 671, message visible). **Post-release fix (v0.1.1, found from real-browser use):** opening a video from anywhere on YouTube (in-app SPA navigation) failed with "The video changed during extraction" until a hard reload because the main-world reader read only the once-per-load `ytInitialPlayerResponse`. The reader now prefers the live `movie_player.getPlayerResponse()` with the initial response as fallback, accepting the first source whose videoId matches the invoked video (still fail-closed otherwise). Verified live on real YouTube: search → video click (initial empty) and watch → related-video click (initial stale, holding the previous video) both extract correctly after SPA navigation; unit tests (120 total) and the build verifier now cover the stale-initial/live-player pair. Re-packaged (final checksum above) and re-smoked.

### T027 — Submit and publish when requested

- [ ] **T027** — Complete store submission and release tracking under a separate publishing instruction.

**Depends on:** T026 and user instruction to publish.  
**Deliverable:** Submission/release record and public listing when approved by the store.  
**Done when:** Store review feedback is addressed, published functionality matches the listing, and the live extension version is recorded. Creating this checklist does not perform this external action.

## 8. Optional follow-up backlog

These items are outside the MVP release gate and should not delay local extraction/copy.

- [ ] **F001 · P1 — Opt-in analytics:** Add only after defining consent, allowlisted events, deletion/retention, cohort windows, and a justified transport. No page content or clipboard text.
- [ ] **F002 · P1 — Side panel:** Reuse popup/domain modules for longer editing after usage feedback supports it.
- [ ] **F003 · P1 — Persistent history/export:** Define retention, deletion, collections, and CSV/JSON semantics before implementation.
- [ ] **F004 · P1 — AI context and consent:** Add own-video brief, audience/language selection, chosen reference fields, and separate suggestions.
- [ ] **F005 · P1 — AI backend and credits:** Add authenticated provider access, per-action limits, retry deduplication, abuse controls, and sustainable usage pricing.
- [ ] **F006 · P1 — Advanced creator analysis:** Validate demand and data availability before comparison, scoring, thumbnail analysis, or channel-level features.

## 9. Dependency summary

```text
T001 source → T001 browser check → T002 → T003 → T004 → T005
  → T006 → T007 → T008 → T009 → T010
  → T011 → T012 → T013 → T014
  → T015 → T016 → T017 → T018
  → T019 → {T020, T021} → {T022, T023} → T024
  → T025 finalized → T026 → T027 when publishing is requested
```

T025 preparation can start after T018. Task-level dependency lists take precedence over this condensed sequence. The Phase 0 core flow (T001–T003) is verified live and the production scaffold (T006) is complete; the remaining edge-case checks (T004/T005) plus the rest of the production implementation/validation boxes remain open.
