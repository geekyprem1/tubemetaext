# Security and network boundary audit (T023)

**Audited:** 2026-10-06  
**Artifact:** production `dist/` (`worker.js`, `content.js`, `popup.html` + hashed assets, icons)  
**Method:** static inspection of the built bundles and source, plus a live CDP network capture over every extension context while exercising the popup, the service worker, storage, and the copy-verification flow.

## Permissions and execution surface

| Check | Result |
| --- | --- |
| Declared permissions | `activeTab`, `scripting`, `storage`, `clipboardWrite` only — no `tabs`, no `<all_urls>`, no host permissions |
| Static content scripts / persistent host access | None; injection happens only after an explicit user invocation via `activeTab` |
| Remote code | None; MV3 default CSP, all code packaged locally (no remote scripts, no CDNs, no `eval`/`new Function` in worker or content bundles) |
| Externally connectable / page bridges | None; the main-world reader is a serialized self-contained function passed through `chrome.scripting`, and no bundle contains `postMessage` — no command bridge of any kind |

## Static code audit (bundles + source)

| Check | Result |
| --- | --- |
| Remote endpoints in `worker.js` / `content.js` | Only the YouTube canonical URL builders (`https://www.youtube.com/watch?v=…`, `https://www.youtube.com/shorts/…`) |
| Remote endpoints in the popup bundle | Only React-internal namespace URLs (`www.w3.org/*` namespace URIs, `react.dev/errors/`) plus the same YouTube builders — no analytics, CDN, or provider hosts |
| Secrets / keys / tokens | None found (case-insensitive scan for api key/secret/bearer/authorization patterns) |
| Network APIs | None in `worker.js`, `content.js`, or `src/` (`fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `importScripts` all absent). The popup bundle contains React's bundled resource-preload helper (`fetch` call site) — this app never calls `ReactDOM.preload`/`preconnect`, so the helper is dead code |
| Console logging | No logging in application code (source-verified); the popup bundle only carries React's internal error-report paths, which do not receive page content |
| HTML sinks | No `dangerouslySetInnerHTML` / `innerHTML` / `outerHTML` in application code (source-verified); all extracted metadata renders as React text nodes. React's internal support for raw HTML exists in the bundle but is unused |
| Message / payload validation | Versioned protocol validator rejects unknown versions/types, malformed or oversized payloads with controlled errors; sender-class rules keep draft mutations extension-UI-only (T008) |
| URL validation | Every persisted URL passes HTTPS + host allowlists (YouTube hosts for channel/canonical URLs, `*.ytimg.com` for thumbnails; http links are upgraded before the allowlist check) |

## Live network capture

With the built extension loaded, CDP `Network` capturing was enabled on the popup page and the service-worker target while the following ran: popup document load and resolve, worker PING, a storage write/read/remove round-trip, and a `VERIFY_COPY_TARGET` flow.

**Result: zero network requests originated from any extension context** (`totalCapturedRequests: 0`; gate PASS). No extraction uploads, no telemetry transport, no remote analytics.

The only page-data-derived network request the extension can cause is the popup summary loading the stored thumbnail URL (`https://*.ytimg.com/...`). That URL is allowlist-validated at ingestion and was observed loading in the T017 live end-to-end screenshot. It is documented in the product notes and the future privacy text (T025).

## Notes and residual items

- `minimum_chrome_version` remains provisional (`102`) until the T005 decision closes against the final API usage; nothing in this audit depends on it.
- The audited artifact contains no provider credentials or AI code; AI work is a future phase with a separate authenticated backend, by design (PRD §25/§26).
- Logging boundaries are additionally guarded by construction: the worker never logs payloads, and error paths carry controlled codes rather than raw page data.
