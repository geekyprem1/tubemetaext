# Release archive and instructions (T026)

**Artifact:** `release/tubemeta-ai-v0.1.2.zip`  
**Version:** 0.1.2  
**Size:** 211,828 bytes · 19 entries (popup redesign with bundled Manrope/IBM Plex Mono fonts, CWS-compliant Tilted Card icons, SPA + Shorts reader fixes)  
**SHA-256:** `ab2f56dc71deb752c4494064383ddaaa118434ed0f0b588ee549adbbfe44f9c6` (recorded in `release/tubemeta-ai-v0.1.2.zip.sha256`)  
**Built:** 2026-10-06 via `npm run package` (build + `scripts/package.mjs`, reproducible: the script rebuilds `dist/` and re-zips it; the checksum changes only when sources, fonts, or icons change).

**Revision history:** `0.1.0` shipped the copy-feedback visibility fix; `0.1.1` added the SPA-navigation reader fix for watch pages; `0.1.2` supersedes both with the Shorts-player fix (below) and includes the popup redesign. The current `0.1.2` archive was rebuilt during the Chrome Web Store image-compliance pass (store icon now 96×96 artwork + 16 px transparent padding per the official docs; required 440×280 promo tile added). Earlier archives are kept for history.

## Archive contents (archive root is the extension root)

```text
manifest.json
popup.html
worker.js
content.js
assets/popup-<hash>.js
assets/popup-<hash>.css
icons/icon16.png
icons/icon32.png
icons/icon48.png
icons/icon128.png
```

Development-only material is excluded by construction (only `dist/` output is zipped): no sources, tests, fixtures, docs, maps, or build scripts.

## Install instructions (local, unpacked)

1. Unzip `tubemeta-ai-v0.1.0.zip` into any folder.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Pin **TubeMeta AI**, open any YouTube video or Short, click the icon (or press the shortcut), and use the popup.

## Release instructions (store)

1. Host `docs/privacy-policy.md` at a public URL and fill the placeholder contact line.
2. Upload `release/tubemeta-ai-v0.1.0.zip` in the Chrome Web Store developer dashboard.
3. Paste the listing copy from `docs/store-listing.md` and upload the `docs/store-assets/` screenshots.
4. Submit for review (T027) and record the store-assigned version after publishing.

## Verification evidence (packaged copy, not the dev folder)

The shipped ZIP was extracted to a clean directory and loaded into Chrome as an unpacked extension:

- **Load:** extension contexts started with no errors; all referenced assets resolve.
- **Extraction from the packaged bundle:** the reader extracted from the packaged `worker.js` ran against live pages — watch route returned the correct title + full description; Shorts route returned the correct title (`ok: true` on both).
- **Live core flow:** a real toolbar invocation against a live watch page produced a session with 4 editable fields and the correct summary; the full copy action wrote the exact §11 export to the system clipboard (3,484 characters, identical layout to the T017 run); the identity guard correctly rejected a stale-session copy attempt after navigation (`VIDEO_CHANGED`), demonstrating fail-closed behavior in the packaged build.
- **Visibility fix (found during this smoke):** the original build rendered the "Copied to clipboard." confirmation below the fold, so a user clicking Copy saw no feedback. The packaged build now scrolls the confirmation into view automatically (`App.tsx` scroll-into-view on copy feedback), verified live: scroll position moved from 0 to 671 and the message appeared above the footer in the captured evidence (`docs/packaged-smoke*.png`).
- Unit/type/lint/build all pass on the packaged revision (120 tests).

## Notes

- The store-assigned extension ID will differ from the local unpacked IDs (unpacked IDs are path-derived).
- Minor UX observation for the future backlog: the copy confirmation lives at the bottom of the content; the auto-scroll resolves visibility, and a future revision could move the feedback into the sticky footer.
- **0.1.1 SPA fix (found in real-browser use):** opening a video from anywhere on YouTube (in-app navigation) failed with "The video changed during extraction" until a hard reload, because the main-world reader read only the once-per-load `ytInitialPlayerResponse`. The reader now prefers the live `movie_player.getPlayerResponse()` (falling back to the initial response) and still fails closed when no source matches the invoked video. Verified live: search → video click (initial empty) and watch → related-video click (initial stale) both extract correctly after SPA navigation; retries no longer needed.
- **0.1.2 Shorts fix (found in real-browser use):** on Shorts pages `#movie_player` exists but returns `null` from `getPlayerResponse()` — the live player is `#shorts-player` (and `ytd-player.getPlayer()` exposes the API). Browsing Shorts is SPA navigation, so Shorts kept failing after the 0.1.1 watch fix. The reader now probes `#movie_player`, `#shorts-player`, and every `ytd-player` element before falling back, accepting only a response whose videoId matches the invoked video. Verified live across two consecutive Shorts SPA navigations; unit tests (123 total) and the build verifier cover the shorts-player and stale-initial cases.
