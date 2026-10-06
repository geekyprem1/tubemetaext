# YouTube extraction source matrix

**Status:** Live verification on 2026-10-05 covered signed-out watch and direct Shorts loads (Chrome 153, fresh profile), including a watch-route end-to-end invocation (popup → stored snapshot → focused-popup copy). Feed-state Shorts, logged-in pages, live/upcoming content, and long-input cases remain unverified.  
**Prototype notes:** [feasibility.md](feasibility.md)

| Field | Candidate source in prototype | Identity/completeness check | Current display/behavior | Evidence status |
| --- | --- | --- | --- | --- |
| Video ID | `/watch?v=` or `/shorts/` route | Strict host, HTTPS, route, and ID validation | Reject unsupported page | Live: URL and player IDs matched on watch and direct Shorts |
| Canonical URL | Parsed current route | Re-read active tab URL after extraction | Strip playlist/tracking/time parameters | Live: canonical URL stored end-to-end; parameter stripping covered by parser tests |
| Title | Player response `videoDetails.title` | Player `videoId` and isolated document URL ID must match; never fall back to an unverified SPA heading | Unavailable/error if absent or oversized | Live: matched on watch; Shorts title included emoji; stored end-to-end |
| Description | Player response `videoDetails.shortDescription` | Confirm whole source, preserve line breaks; compare with visible full description | Unavailable when omitted; confirmed empty only for explicit `""` | Live: watch 2,376 chars with newlines + 11 URLs vs 115-char DOM preview, stored end-to-end; Shorts 63 chars with hashtags. Expanded-UI comparison pending |
| Player keywords / tag candidate | Player response `videoDetails.keywords` | Verify array belongs to matching player video ID | Candidate label; do not claim original tags | Live: 27 candidates on watch (stored); absent on a Shorts → unavailable. "Original tags" semantics unproven |
| Hashtags | Derived from available title and description | Unicode-aware matches; ignore URL fragments | Preserve first occurrence; partial when an input is unavailable | Live: 5 derived and stored end-to-end; mock covers Unicode fragments |
| Channel name | Player response `videoDetails.author` | Same matched response | Unavailable if absent | Live: present on watch and Shorts; stored end-to-end |
| Channel URL | `microformat.playerMicroformatRenderer.ownerProfileUrl` | HTTPS URL normalization; production host allowlist needed | Unavailable if absent or invalid | Live: pages returned `http://` links → prototype upgrades to HTTPS; stored end-to-end |
| Thumbnail | `videoDetails.thumbnail.thumbnails[]` | Same matched response; HTTPS and exact host allowlist needed | Use returned URL; do not synthesize a size | Live: 5 candidates on both routes; host allowlist still `ytimg.com`-only |
| Publish date | Microformat `publishDate`, then `uploadDate` | Exact value; scheduled/premiere date is not substituted | Unavailable if not exact | Live: full ISO timestamps with offsets → prototype stores date-only; stored end-to-end |
| Duration | `videoDetails.lengthSeconds` | Exact nonnegative integer; ensure not upcoming/live elapsed time | Store seconds; unavailable if no fixed duration | Live: exact strings (watch 213; Shorts 44) |
| Views | `videoDetails.viewCount` | Exact nonnegative integer; never parse abbreviations into exact values | Store integer, preserving zero | Live: exact integer stored end-to-end; live/upcoming not exercised |
| Page type | Validated page route | Revalidate tab URL and isolated document URL | `watch` or `shorts` | Live: both routes |
| Content type | Active Shorts route after matching ID; no watch route inference | Verify current route/player identity | Shorts route → `short`; watch route → `unknown` | Live route behavior confirmed (watch stayed unknown); duration never used |
| Playback status | Microformat live broadcast flags | Only explicit source evidence | Unknown if unverified | Not yet exercised on live/upcoming pages |

**Additional live findings (2026-10-05)**

- `window.ytInitialPlayerResponse` is present on direct `/shorts/<id>` loads and `/watch` loads, but absent in the Shorts feed state (`/shorts/` reached by SPA navigation). The prototype only supports the direct routes.
- A fresh profile can be redirected to `consent.youtube.com` before YouTube content loads (observed on the Shorts feed); the prototype has no deliberate handling for that state yet.
- The collapsed DOM description on a watch page (115 chars) is far shorter than the player-response description (2,376 chars), confirming the player response as the primary description source.
- Chrome serializes injected functions and drops their closures; the main-world reader must stay self-contained or it fails inside the page (found live, fixed, and now covered by a serialization-aware mock).
- **SPA navigation staleness (found live 2026-10-06, fixed in v0.1.1):** `window.ytInitialPlayerResponse` is written once per full page load; after in-app navigation (clicking any video on YouTube) it keeps the previous page's video or nothing, so reading it alone returned `PLAYER_ID_MISMATCH` → `VIDEO_CHANGED` until a hard reload — exactly the "open a video from YouTube and it errors until F5" report. The production reader now prefers the live `movie_player.getPlayerResponse()` and keeps the initial response as a fallback, accepting the first source whose `videoId` matches the invoked video. Verified live for both SPA cases: initial empty (search → video click) and initial stale (watch → related-video click, `initial` held the previous video while the player held the new one). Unit tests and the build verifier now cover the stale-initial/live-player pair.

**Current conclusion:** Title, description, channel name, exact counts/duration, thumbnails, hashtags, and the canonical URL are viable on both supported routes and verified through a real watch-route invocation after the normalizer and serialization fixes. Player keywords remain candidates with an unproven "original tags" claim and can be absent on Shorts. Remaining before production readiness: Shorts-route invocation, logged-in pages, live/upcoming states, and long-input limits.
