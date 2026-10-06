# Chrome Web Store listing package (T025)

Package-ready copy for the Chrome Web Store listing. It describes extraction, editing, transcript viewing, and copying. AI generation is absent from this release.

## Product name

**TubeMeta AI**

## Summary (from the package manifest)

> Extract and copy YouTube metadata and available transcripts. Edit fields locally, with no account or separate server.

The store shows this "Summary from package" automatically from the manifest `description` (`src/manifest.ts`); the earlier hand-written short description was retired when the transcript feature landed.

## Detailed description (store form text)

```text
Extract, edit, and copy YouTube metadata — instantly and privately, in one click.

Open any YouTube video or Short, click TubeMeta AI, and see everything the page makes publicly available:

• Title, description, and hashtags
• Publicly visible tags, when the video exposes them
• Channel name, video URL, and thumbnail
• Duration, views, and publish date, when available
• Video type: video or Short

EDIT BEFORE YOU COPY
Every field can be edited right in the popup. Edits are kept as drafts per video for your browsing session, with live character and item counts and a one-click reset back to the original.

COPY THE WAY YOU WANT
Copy a single field — or copy everything in one clean, consistent export that's ready to paste anywhere.

TRANSCRIPTS WHEN YOU NEED THE WORDS
View the caption track of the current video and copy the full transcript in one click. Videos without captions can't provide a transcript.

LOCAL-ONLY BY DESIGN
• No account, no sign-in, no TubeMeta server
• Nothing you extract is uploaded — metadata, edits, and copies stay on your device
• No analytics, no tracking, no ads
• The extension can only read a page when you invoke it on the active tab

BUILT TO BE HONEST
• Some fields may be unavailable depending on the video or page state. Unavailable fields are labeled — never invented.
• Tags appear only when YouTube exposes them publicly for the video.
• No AI generation in this release: "AI" is the roadmap, not today's feature. This version is a fast, local metadata toolkit.

TubeMeta AI is an independent tool and is not affiliated with or endorsed by YouTube or Google. YouTube is a trademark of Google LLC.
```

> **TubeMeta AI helps YouTube creators instantly extract and reuse video metadata — entirely inside the browser.**
>
> Open a YouTube video or Short, click TubeMeta AI, and get its available metadata:
>
> • Title, description, and hashtags
> • Publicly visible tags when YouTube exposes them
> • Channel name, video URL, and thumbnail
> • Duration, views, and publish date when available
> • Video type: Video or Short
>
> Every field can be edited before copying. Copy a single field or copy everything with one click in a clean, fixed format. Your edits stay with the video for the browser session and can be reset to the original at any time.
>
> When a video has captions, view its transcript in the popup or copy it directly. Choose from the caption languages YouTube makes available for that video. The transcript is separate from the metadata export.
>
> **Local-only by design**
> • No account, no sign-in
> • Metadata extraction runs in your browser; caption requests go only to YouTube
> • No analytics or tracking
> • Nothing you extract is uploaded anywhere
> • Access happens only when you invoke the extension on the active tab
>
> **Good to know**
> • AI generation is not part of this release. The name says AI, but the language features arrive later — this version is a fast, local metadata toolkit.
> • Some fields may be unavailable depending on the video or page state. Unavailable fields are labeled — they are never invented.
> • Tags show publicly visible keywords only when YouTube exposes them for the video.
> • The popup loads the video thumbnail image from YouTube's image host (`ytimg.com`).
> • A transcript request fetches the selected caption track from YouTube on the current page. The extension has no separate transcript server.
> • Drafts last for the browsing session and can be cleared at any time with "Clear session data".

## Category and language

- Category: **Productivity**
- Language: **English**

## Screenshot inventory (1280×800 PNG, up to 5)

| File | Shows | Caption (optional overlay) |
| --- | --- | --- |
| `store-assets/screenshot-1-extract.png` | Shipped popup on a real `/watch` page with complete metadata, Copy buttons, and counters | "Extract a video's metadata in one click" |
| `store-assets/screenshot-2-edit.png` | Shipped editing state: "Edited" badge, Reset, and the updated character count | "Edit any field before you copy" |
| `store-assets/screenshot-3-copy.png` | Real session details: video info list, hashtags, and the visible "Copied to clipboard." confirmation | "Copy one field - or everything" |

These captures show the previous popup layout. Recapture the redesigned popup and a transcript state before store submission, then regenerate with `scripts/compose-store-assets.ps1`. Screenshots must stay 1280×800 with square corners and full-bleed layouts (no padding), per the official screenshot requirements.

## Promotional images

| File | Size | Status | Design |
| --- | --- | --- | --- |
| `store-assets/promo-440x280.png` | 440×280 | **Required** | Full-bleed red gradient with the brand card motif |
| `store-assets/promo-1400x560.png` | 1400×560 | Optional (marquee featuring) | Same motif, extended composition |

Generated by `scripts/generate-promo.ps1`. Per the official image guidance: full bleed, no text, saturated colors, well-defined edges, works when shrunk to half size, and does not rely on a white or light-gray background.

## Store icon

`public/icons/icon128.png` — the "Tilted Card" brand mark (red gradient tile with a tilted white metadata card, red play wedge, and data lines), generated by `scripts/generate-icons.ps1`. The 128 px store icon follows the Chrome Web Store convention from the official image docs: **96×96 artwork with 16 px of transparent padding on each side**; the 16/32 px toolbar sizes use a bold simplified variant that fills its frame. The icon has no outer edge and only a small contrast shadow, and its saturated red tile reads on both light and dark backgrounds. Included in the release archive.

## Single purpose (privacy tab field)

```text
TubeMeta AI extracts the publicly visible metadata of the YouTube video or Short currently open in the active tab — title, description, tags, hashtags, and related details — and lets the user view, edit, and copy it, including the video's available caption transcript on request. All processing happens locally in the browser.
```

## Permission justifications (store review form)

| Permission | Justification text |
| --- | --- |
| `activeTab` | activeTab is used to read metadata from the YouTube page the user is explicitly viewing, and only after they click the extension icon. The access is temporary, scoped to the active tab, and is used solely to extract the video's public metadata and, when requested, its caption track. |
| `scripting` | scripting is used to inject the extension's own packaged, self-contained reader functions into the active tab to read the video metadata and, on request, the caption track from the page. No remote code is loaded, and nothing is injected without the user's explicit invocation. |
| `storage` | storage keeps the per-tab extraction snapshot and the user's in-session field edits (drafts) in chrome.storage.session so the popup can restore them during the browsing session, and stores one local preference (theme) in chrome.storage.local. Nothing is synced or transmitted; session data clears when the browser closes or via the "Clear session data" action. |
| `clipboardWrite` | clipboardWrite is used only when the user presses a Copy button, to write the requested text — a single metadata field, the full export, or the caption transcript — to the clipboard. The extension never reads the clipboard. |
| Remote code | **No, I am not using remote code.** All code is packaged in the extension; no remote scripts, modules, or eval. (Select "No" on the form — never "Yes".) |
| Data usage disclosure | The extension does **not** collect or transmit user data. All data-type checkboxes stay unchecked, and the three certifications (no selling, no unrelated use, no creditworthiness use) are checked. See `docs/privacy-policy.md`. |

## Data disclosure answers (privacy tab)

- Does the extension collect personally identifiable information? **No.**
- Health, financial, authentication, personal communications, location? **No.**
- Web history / user activity: the extension does not collect or upload browsing history. A transcript request fetches captions from YouTube for the current video. **No collection by the extension.**
- Selling data to third parties? **No.** Analytics? **None shipped.**

## Privacy policy URL

Deploy the `privacy-policy/` folder (Netlify drag-and-drop, or repo-linked with publish directory `privacy-policy`) and paste the resulting URL into the store form. The hosted page (`privacy-policy/index.html`) matches `docs/privacy-policy.md`.

## Claims checklist (do not claim what is not measured)

- No SEO ranking, view-count, or growth guarantees anywhere in the listing.
- No AI-generation claims in this release.
- Field availability is described as "may be unavailable" — matching the honest field states.
