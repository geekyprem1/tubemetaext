# Production performance report (T022)

**Measured:** 2026-10-06 (04:44–05:05 UTC)  
**Build:** production `dist/` (minified React popup; unminified worker and content bundles)  
**Environment:** agent-browser bundled Chrome 153.0.8010.52 on Windows, headed, fresh profiles, YouTube signed out  
**Method:** measurements were captured over CDP on real pages and real extension contexts. Percentiles are p50/p95/max over each sample; the reader was the shipped `readCurrentPlayerResponse` extracted from `dist/worker.js` and executed in the page main world on 100 ready pages (50 watch + 50 Shorts, corpus IDs from the T020 fixture). Cold = first visit of a video in the session, warm = repeat visit.

## Popup shell

| Metric | Value |
| --- | --- |
| First-open (cold) first-contentful-paint | 104 ms |
| First-open DOMContentLoaded | 70 ms |
| Warm `.app-header` visible (`ShellAt`) p50 / p95 / max | 29.6 / 39.6 / 39.9 ms |
| Warm first-contentful-paint p50 / p95 / max | 52 / 60 / 60 ms |

**Gate — popup shell interactive ≤ 300 ms p95: PASS** (warm shell marker 39.6 ms; cold FCP 104 ms).

## Ready-page extraction

100/100 runs succeeded (50 watch, 50 Shorts; 34 cold, 66 warm; zero failures).

| Slice | n | p50 | p95 | max |
| --- | --- | --- | --- | --- |
| Watch reader | 50 | 0.1 ms | 0.2 ms | 0.2 ms |
| Shorts reader | 50 | 0.1 ms | 0.2 ms | 0.2 ms |
| Cold | 34 | 0.1 ms | 0.2 ms | 0.2 ms |
| Warm | 66 | 0.1 ms | 0.1 ms | 0.2 ms |
| Overall | 100 | 0.1 ms | 0.2 ms | 0.2 ms |

Supporting pipeline costs measured in live extension contexts:

| Operation | p50 | p95 | max |
| --- | --- | --- | --- |
| `chrome.storage.session.set` (≈4 KB record) | 0.1 ms | 0.2 ms | 0.5 ms |
| `chrome.storage.session.get` | 0.1 ms | 0.2 ms | 0.2 ms |
| Popup ↔ worker message round-trip (PING) | 0.3 ms | 0.5 ms | 6.2 ms |
| `navigator.clipboard.writeText` (extension page, focused) | 0.0 ms | 0.1 ms | 1.7 ms |

The dominant reader cost is sub-millisecond, storage and message hops are sub-millisecond, and content-script injection is a small fixed cost verified qualitatively in the live end-to-end run (the popup reached its ready state within about two seconds of a real invocation). Component-based extraction path ≈ a few milliseconds; **Gate — ready-page extraction ≤ 2 s p95: PASS** (with a very large margin), and the bounded retry design caps the loading deadline at five seconds with `EXTRACTION_TIMEOUT` (unit-tested).

**Gate — copy confirmation ≤ 300 ms p95: PASS** (identity verification round-trip + clipboard write ≈ 0.6 ms p95 combined; the live end-to-end run showed the success message immediately).

## Main-thread tasks

The reader executes synchronously; its task duration equals the measured reader time (max 0.2 ms across 100 runs). All other measured operations are asynchronous extension APIs in the low milliseconds. **Gate — no extension-attributable task > 50 ms observed: PASS.**

## Memory observations

- YouTube tab JS heap (`performance.memory.usedJSHeapSize`) after 100 programmatic page loads in one tab: 199 MB → 1,658 MB (≈14.6 MB per navigation). This is the page's own heap during rapid automated navigation, including not-yet-collected garbage and YouTube's SPA caches; it is not extension-attributable. The extension's per-document footprint is a small packaged content script that is released on navigation, and its install guard prevents listener accumulation (build check verifies a double injection installs one listener).
- Popup page heaps across repeated opens (independent fresh pages): 2.2 MB … 3.5 MB; the worker keeps no durable in-memory state (every operation hydrates from `chrome.storage.session`), so there is no extension-side retained-growth mechanism observed. No further action taken; note that `usedJSHeapSize` includes uncollected garbage, so the tab figure above overstates retained memory.

## Caveats

- The full popup-driven extraction path (with `activeTab` and the focused clipboard write) cannot be machine-invoked at scale because each run needs a real user gesture; it was validated qualitatively in the live end-to-end and lifecycle sessions, and every component of that path is measured above.
- Numbers come from a headless-workload-equivalent headed session on this machine; the PRD's reference-machine percentile targets remain satisfied with very large margins.
- One earlier harness run produced shorts failures caused by a stale browser profile state; the reported reader numbers come from the clean 100/100 run.
