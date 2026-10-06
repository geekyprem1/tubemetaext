# Phase 0 — Feasibility log

**Updated:** 2026-10-05  
**Prototype:** [`../phase0-prototype/`](../phase0-prototype/)  
**Tasks:** [TASKS.md](../TASKS.md)  
**Status:** Source written; mocked Node verification passing (9 cases, serialization-aware); live Chrome checks completed on 2026-10-05 including a real user-invocation end-to-end run on the watch route (stored snapshot + successful focused-popup copy). Edge-case coverage (Hindi/Devanagari, live states, long inputs, logged-in) remains open.

A local prototype run was performed on 2026-10-05 through the agent-browser CLI with its bundled Chrome build (the earlier computer-use connector exposed no browser, so the CLI route was used instead). Results and remaining gaps are recorded below.

## Scope

This phase checks the extension permission model, current video identity, full descriptions, original tag availability, optional fields, Chrome session storage, and clipboard behavior before the production UI is built. This document distinguishes code-level/mock evidence from a real Chrome page result.

## Prototype design

- Manifest V3; vanilla JavaScript; no installed package dependencies.
- Requests use `activeTab`, `scripting`, `storage`, and provisionally `clipboardWrite`.
- No persistent host permission, static content script, backend, or analytics transport.
- The popup requests metadata on user invocation. The worker validates HTTPS host and route, then reads `window.ytInitialPlayerResponse` through a short, packaged main-world function whose result must match the current video ID.
- A prototype-only `Ctrl+Shift+Y` command (`_execute_action`) was added during testing so the popup can be invoked by keyboard as well as by toolbar click; both invocation paths were exercised.
- A packaged isolated-world function separately verifies the document URL matches the requested current video ID. It does not use an unverified heading as a fallback.
- The worker normalizes results and saves the snapshot under `chrome.storage.session`.
- The popup renders values using `textContent`; Copy first asks the worker to recheck tab/video/request identity and then calls `navigator.clipboard.writeText`.
- Player `videoDetails.keywords` is labeled **Player keywords (candidate)**. The prototype does not claim these values have been verified as the creator-entered original tag list.
- A `/shorts/VIDEO_ID` route is treated as evidence for the Short page type and Short content type only if the player ID matches. A watch route leaves content type unknown. Duration alone is never used to label long/Short content.

## Implemented limits

Current prototype guards reject description/title strings over 100,000 JavaScript characters, keyword arrays over 1,000 items, or keyword entries over 2,000 characters. Oversized text is shown as a field error; it is not silently truncated. These are provisional engineering limits, not validated YouTube or Chrome limits. There is not yet a measured long-description/browser messaging test.

Dates are accepted only in `YYYY-MM-DD` or full ISO timestamp form (the timestamp is reduced to its date part). View counts must be exact nonnegative integer strings. Thumbnail and channel links must use HTTPS (live `http:` links from YouTube are upgraded); thumbnail hosts must end in `ytimg.com` in this prototype. Further host validation is needed before production.

## Evidence

### Code-level checks

`node --check worker.js`, `node --check popup.js`, JSON manifest parsing, and `node --test verify-prototype.mjs` were run. The syntax and manifest checks passed; all 9 mocked cases passed (8 original plus a regression case for the `ACCESS_DENIED` path added after the live run). The harness injects mocked tabs/player response/storage and now re-creates injected functions in a page-like VM context, simulating Chrome's function serialization so closure-dependent readers fail the same way they would in the browser. It still does not prove renderer behavior, permission prompts, live metadata availability, or clipboard success in a real window.

### Live browser checks

A local Chrome session was established on 2026-10-05 through the agent-browser CLI (bundled Chrome 153.0.8010.52 on Windows, fresh signed-out profile, extension loaded unpacked via the `--extension` flag, extension ID `jeoanffpbballacanfbfbegcacddeklc`). Results:

- The extension loads unpacked and runs with exactly `activeTab`, `scripting`, `storage`, and `clipboardWrite`; `chrome.permissions.getAll()` confirms no host permissions or persistent origins.
- No extraction or storage write happens before popup invocation: `chrome.storage.session` stays empty, and no tab URLs are readable, until a popup-initiated request runs.
- A programmatically opened popup (`chrome.action.openPopup()` from the worker) does **not** receive an `activeTab` grant; the worker is denied page access, refuses before any injection, and stores nothing. This is the correct fail-closed behavior; the popup shows the controlled `ACCESS_DENIED` message after the worker fix below.
- A real user invocation (toolbar action and the `Ctrl+Shift+Y` command, both tested) grants `activeTab` and the full flow succeeds on the watch route: the popup rendered 10 field cards ("Available metadata loaded; 2 fields unavailable."), the session snapshot was stored (`snapshot:<tabId>:dQw4w9WgXcQ`) with title, full description (2,376 chars), 27 keyword candidates, 5 hashtags, channel name, HTTPS channel URL, date-only publish date, exact duration (213 s) and views, and the focused-popup Copy flow completed ("TITLE copied"). The two unavailable fields are the by-design watch-route `contentType` and the absent `playbackStatus` flags. Popup screenshot of the successful run: `docs/phase0-watch-popup.png`.
- `chrome.runtime.reload()` on an extension loaded via the browser's command-line flag left it in the `blocked` state (`ERR_BLOCKED_BY_CLIENT`) in this Chrome build. Restart the browser session after editing prototype files instead of reloading in place.
- Clipboard: `navigator.clipboard.writeText` from an unfocused extension page fails with `NotAllowedError: Document is not focused`; with the popup focused after a real invocation, the identity-check → copy flow completed and reported success. `clipboardWrite` stays declared as the prototype's answer; whether a focused write would also succeed without that permission is untested.

Source evidence (field-level table in [source-matrix.md](source-matrix.md)):

- Watch route (`/watch?v=dQw4w9WgXcQ`, signed out): video-ID-matched title; a 2,376-character description with newlines and 11 links; 27 player keyword candidates; five thumbnail candidates; exact view count and duration strings; full ISO `publishDate`/`uploadDate`. The collapsed DOM description showed only 115 characters, confirming the player response is the needed source for complete descriptions. All of this was additionally verified end-to-end through the popup and the stored snapshot.
- Shorts route (`/shorts/n2c1NroYCLs`, signed out, direct load): player response present and video-ID-matched; title contained emoji; description contained hashtags; exact-format duration (`44`); **no keywords array** — absent keywords stay unavailable, not empty, as designed.
- The Shorts *feed* state (`/shorts/` after SPA navigation) does not expose `window.ytInitialPlayerResponse`; the player source is only guaranteed on direct `/shorts/<id>` loads and on watch loads.
- A fresh profile was redirected to `consent.youtube.com` before the Shorts feed loaded until consent was accepted; watch loads did not trigger it in this session. This state has no deliberate prototype handling yet.

Prototype fixes applied from these findings:

- `worker.js`: unreadable tab URL (no `activeTab` grant) previously threw on a null destructure and surfaced a generic failure; it now returns the controlled `ACCESS_DENIED` code. Regression mock added.
- `worker.js`: the main-world reader depended on worker-scope helper functions. Chrome serializes injected functions and drops their closures, so the reader threw in the page and every real invocation failed with `VIDEO_CHANGED` even after the permission gate passed. The reader is now fully self-contained, the now-unused worker helpers were removed, and the mock harness now simulates serialization so this class of bug is caught by tests.
- `worker.js`: `normalizeDate` accepts full ISO timestamps with timezone offsets (live YouTube returns `YYYY-MM-DDTHH:MM:SS-07:00`) and stores the date-only portion.
- `worker.js`: `normalizeHttpsUrl` upgrades `http:` to `https:` before the host allowlist check (live pages returned `http://www.youtube.com/@channel`).

Not yet covered: logged-in pages, Hindi/Devanagari live content, long descriptions near the size limits, live/upcoming playback states, and a Shorts-route invocation run (direct page reads were verified but the popup flow was exercised on the watch route only).

## Source hypotheses — live status

| Field | Prototype candidate | Live evidence |
| --- | --- | --- |
| Video ID and canonical URL | Validated supported page route and `v` parameter | Verified on `/watch` and direct `/shorts` loads; player ID matched the URL ID in both; canonical URL stored end-to-end |
| Title | Video ID-matched `ytInitialPlayerResponse.videoDetails` | Verified on both routes including an emoji-bearing Shorts title; stored end-to-end |
| Description | `videoDetails.shortDescription` | Watch: 2,376 chars with newlines and 11 URLs (DOM preview only 115); Shorts: 63 chars including hashtags. Full text stored end-to-end; expanded-UI comparison still pending |
| Tags | `videoDetails.keywords`, explicitly presented as candidates | Watch: 27 candidates present and stored; Shorts: array absent → unavailable. "Original tags" semantics remain unproven |
| Hashtags | Derived from available current-video title/description | Derivation verified end-to-end (5 hashtags stored for the watch sample); Unicode/URL-fragment handling covered by mock |
| Channel/title owner | `videoDetails.author`, `microformat.ownerProfileUrl` | author present; ownerProfileUrl returned `http://` links → upgraded to HTTPS and stored end-to-end |
| Thumbnail | The last URL in `videoDetails.thumbnail.thumbnails` | Five candidates on both routes; host validation still limited to `ytimg.com` |
| Publish date | Exact ISO `publishDate`, else `uploadDate` | Live values are full ISO timestamps with offsets → normalizer stores date-only; verified end-to-end |
| Duration/views | `lengthSeconds`, exact integer `viewCount` | Exact strings on both routes; stored end-to-end; live/upcoming cases not yet exercised |
| Playback status | `liveBroadcastDetails` booleans and explicit recorded marker | Not yet exercised on a live/upcoming page |

## Results and decisions

Append dated, reproducible observations here. For each real-page result record route, language, sign-in state, field source, completeness proof, and field status; avoid storing account names, tokens, private data, or unnecessary page contents.

| Date | Scenario | Outcome | Decision |
| --- | --- | --- | --- |
| 2026-10-05 | Prototype source, syntax/manifest checks, and mocked cases | All code-level checks pass; real Chrome/YouTube outcome pending | Continue only after live browser and clipboard checks |
| 2026-10-05 | Earlier computer-use connector attempts | Chrome connector returned no browser or tabs; extension not loaded | Use the agent-browser CLI path instead |
| 2026-10-05 | Unpacked load + programmatic openPopup on a real watch page | Load OK; popup flow fail-closed without `activeTab`; worker surfaced a generic code → fixed to `ACCESS_DENIED`; storage stayed empty | Re-test confirms the controlled message; proceed to a real-invocation run |
| 2026-10-05 | Direct player-response reads, watch + Shorts (signed out) | ID-matched title/description/keywords/links/views/duration captured; `http:` channel URL and full ISO dates rejected by the old normalizers → fixed | Sources viable for watch + direct Shorts; feed state, live content, and invocation run remain open |
| 2026-10-05 | Unfocused extension-page clipboard probe with `clipboardWrite` declared | `writeText` fails with `NotAllowedError: Document is not focused` | Verify copy behavior in the focused popup during the real-invocation run |
| 2026-10-05 | First real invocation (before the serialization fix) | `activeTab` granted and the request counter recorded, but the injected reader failed (closure dropped by function serialization) → `VIDEO_CHANGED`; the mock could not catch this | Reader made self-contained; mock upgraded to simulate serialized injection; retest passed |
| 2026-10-05 | Real user invocation on the watch route after the fix (toolbar + `Ctrl+Shift+Y`) | Popup rendered 10 fields; snapshot stored with all available fields; focused-popup copy succeeded ("TITLE copied"); 2 by-design unavailable fields | T001 core flow verified end-to-end; proceed with Phase 0 edge-case wrap-up |
