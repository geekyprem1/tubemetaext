# TubeMeta AI — Privacy Policy

**Version:** 1.0 · **Effective:** 2026-10-06

TubeMeta AI is a Chrome extension that extracts metadata from the YouTube video or Short you are viewing so you can edit and copy it. This policy describes exactly what the extension does with data — matching the shipped behavior.

## Summary

- No account, sign-in, or server.
- No analytics, tracking, or telemetry of any kind.
- No uploads: extracted metadata never leaves your device.
- Access to a page happens only when you explicitly invoke the extension on the active tab.

## What the extension reads

When you click the TubeMeta AI toolbar icon (or press its keyboard shortcut) on a YouTube video or Short page, the extension reads the metadata of that page — such as title, description, publicly visible tags, hashtags, channel name, duration, view count, publish date, thumbnail URL, and video URL — and displays it in the popup.

This access is temporary and scoped to the active tab, granted by Chrome only for the invocation you perform. The extension cannot read pages in the background or on tabs you have not invoked it on.

## Where your data goes

**Nowhere.** The extension ships no backend. It contains no analytics, no remote logging, and no network transport for user data. Extracted metadata, your edits, and copied text are never transmitted.

The popup displays the video thumbnail, which is loaded as a normal image from YouTube's image host (`ytimg.com`). That request fetches an image file; it does not transmit your extracted metadata, edits, or clipboard content.

## What is stored, and for how long

| Data | Where | Lifetime |
| --- | --- | --- |
| Extraction snapshot per tab and video | In-memory session storage (`chrome.storage.session`), extension-owned | Until the browser fully closes, the tab is closed, or you clear it |
| Your edits (drafts) | Same session storage | Same as above; "Reset to original" removes an edit |
| Theme preference | Local extension storage (`chrome.storage.local`, not synced) | Until uninstalled or changed |

Session data is never synced to your Google account and is never written to disk by the extension. The popup includes a **Clear session data** action that deletes the stored snapshots and drafts for the current browsing session immediately.

## Clipboard

The extension writes to the clipboard **only when you press a Copy button** — copying a single field or the full export. It never reads your clipboard.

## Permissions and why they exist

- **activeTab** — lets the extension read the page you explicitly invoked it on. No persistent site access is requested.
- **scripting** — runs the packaged metadata reader inside the invoked tab.
- **storage** — keeps session snapshots/drafts and the theme preference described above.
- **clipboardWrite** — performs the copy actions you request.

The extension requests no host permissions and no background page access.

## What the extension does not do

- No collection of personal data, browsing history, or usage statistics.
- No remote code: all code is packaged in the extension.
- No selling or sharing of data with third parties (there is nothing collected to share).
- No cookies set by the extension.

## Children's privacy

The extension collects no personal data from anyone, including children.

## Changes

If a future version adds optional AI features or any networked behavior, this policy and the store disclosures will be updated before those features ship, and networked features will require explicit user action. The current release has none.

## Contact

Questions about this policy: _[add contact email before publishing]_
