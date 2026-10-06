# Browser lifecycle checklist (T021)

**Updated:** 2026-10-05  
**Build:** production `dist/` loaded unpacked  
**Browser:** agent-browser bundled Chrome 153.0.8010.52 (headed), fresh profile, signed out  
**Evidence:** `tests/unit`, `tests/integration`, the T017 end-to-end run, the T020 corpus run, and two scripted lifecycle sessions driven over CDP with one real toolbar invocation.

| Scenario | Expected behavior | Outcome | Evidence |
| --- | --- | --- | --- |
| Immediate close/reopen after acknowledged editing | Accepted edits survive popup closure; the same tab/video restores its draft | **PASS** — after editing the title to "Lifecycle Edit 1" (indicator showed `Saved`), the popup was closed and reopened; the editor restored "Lifecycle Edit 1" from session storage | Live lifecycle session; `overrides` in `chrome.storage.session` persisted through the cycle |
| Worker restart (service worker terminated) | A fresh worker hydrates records/counters/epoch from session storage and continues cleanly | **PASS** — the service worker target was terminated over CDP (`gone`); the next popup open woke a fresh worker that hydrated the stored draft (title restored) and accepted a new edit (`Saved`, `overrides {"title":"Lifecycle Edit 2"}`) | Live lifecycle session; read-through repository tests |
| Pending saves never reported as saved prematurely | `Saved` appears only after the storage acknowledgement; failed writes keep the editor usable | **PASS** — debounced patches show `Saving…` until the PATCH_DRAFT acknowledgement returns, then `Saved` (auto-clearing); failures map to `Couldn't save edits` without discarding content | Live sessions; popup reducer + coordinator tests |
| Storage failure / quota pressure | Quota pressure evicts only unedited records; edited drafts are never evicted; persistent failure surfaces `STORAGE_FAILED` visibly | **PASS (unit)** — eviction/`STORAGE_FAILED` behavior pinned by storage tests; forcing real 10 MB `chrome.storage.session` pressure was not attempted in the browser | `session-storage.test.ts` |
| Browser-session expiration | `chrome.storage.session` clears when the browser session ends; no stale content is shown | **PASS** — every fresh browser launch starts with empty session storage (observed across sessions); the popup never renders cached content before resolving the active tab | Live sessions; storage documentation |
| Extension reload/update expiration | Reload/update clears session storage; the flag-loaded prototype cannot reload in place | **PASS (documented)** — Phase 0 recorded that `chrome.runtime.reload()` on a flag-loaded unpacked extension leaves it blocked and clears its session data; unpacked installs have no store-update path | `docs/feasibility.md` |
| Two tabs / per-tab isolation | Snapshots and drafts are keyed by tab + video; unresolved tabs never show cached data | **PASS** — reopening the popup while the active tab was an extension page correctly showed "No YouTube video detected" instead of cached YouTube data; per-tab/video key isolation is unit-tested | Live lifecycle session; storage + coordinator tests |
| Permission denial (no `activeTab`) | Fail-closed: no injection, no storage writes, controlled `ACCESS_DENIED` message | **PASS** — a programmatically opened popup without a user grant shows "Chrome could not access this page…" and nothing is stored; the real invocation grants access | T015/T017 runs; coordinator fail-closed tests |
| Clipboard denial | Failed writes fall back to selectable manual-copy text and `Couldn't copy. Try again.` | **PASS (unit + prior live observation)** — an origin-level clipboard-write denial was overridden by the extension's declared `clipboardWrite` permission (the write still succeeded, re-confirming the permission decision); the fallback path is unit-tested, and the unfocused-window failure mode (`Document is not focused`) was observed live in Phase 0 | `clipboard.test.ts`; `docs/feasibility.md` |
| Manual-copy fallback | Selectable text appears on write failure and is selectable/focusable | **PASS** — implemented and keyed off write failures only; covered by unit tests (live denial is overridden by the extension permission as noted above) | `clipboard.test.ts`; popup code |

## Notes

- All live lifecycle evidence was produced with a single real toolbar invocation per session (the only reliable way to obtain `activeTab`); subsequent actions were driven over CDP.
- The extension's session design intentionally discards pending, unacknowledged debounce input on a forced shutdown — the architecture's "last accepted edit" is the last acknowledged revision, which the close/reopen and worker-restart checks confirm.
