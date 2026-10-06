# TubeMeta AI — Product Requirements Document (PRD)

**Version:** 1.1  
**Updated:** 2026-10-05  
**Product:** TubeMeta AI  
**Platform:** Chrome Extension  
**Primary Users:** YouTube creators, marketers, agencies, researchers  
**Status:** MVP Specification

**Revision summary:** Clarifies extraction sources, video identity, session drafts, copy output, permissions, privacy, launch criteria, and AI usage limits. Performance and business targets below are proposed acceptance targets, not validated results.

---

## 1. Product Overview

TubeMeta AI is a Chrome extension that lets users extract, edit, and copy available public metadata from supported YouTube video and Shorts pages.

With one click, TubeMeta AI detects the current YouTube video and extracts:

- Video title
- Description
- Tags
- Hashtags
- Video URL
- Channel name
- Content type (Long / Short / Unknown), when verifiable
- Thumbnail URL
- Publish date
- Duration
- Views, when reliably available

The MVP field set is limited to the fields defined in Section 8. Availability varies by video and page state.

The MVP focuses on **fast extraction, clean presentation, and one-click copying**.

A future AI layer will allow users to rewrite and improve extracted metadata, generate alternative titles, optimize descriptions, and generate tags/hashtags.

---

# 2. Problem Statement

YouTube creators frequently study successful videos and reuse ideas from their metadata.

Today, creators often have to:

1. Open the YouTube video.
2. Manually inspect the title.
3. Expand and copy the description.
4. Find tags using third-party tools or page inspection.
5. Copy hashtags separately.
6. Organize everything manually.
7. Paste it into another tool.

This process is slow and fragmented.

TubeMeta AI solves this by providing a **single-click metadata extraction workflow** directly inside Chrome.

---

# 3. Product Vision

> "The fastest way to extract, understand, and reuse YouTube video metadata."

TubeMeta AI should eventually become a lightweight **YouTube creator intelligence assistant**, starting with metadata extraction and expanding into AI-powered content optimization.

---

# 4. Goals

## MVP Goals

- Detect the current YouTube video when the user opens the extension.
- Support both YouTube Long videos and Shorts.
- Extract available metadata reliably.
- Present metadata in a clean extension interface.
- Allow one-click copying of individual fields.
- Allow one-click copying of all metadata.
- Allow users to edit extracted content before copying.
- Preserve edits when the popup closes during the current browser session.
- Prevent stale results from another video or tab from being displayed or copied.
- Work without requiring a backend for basic extraction.
- Keep the extension fast and lightweight.

## Phase 2 Goals

- AI title rewriting.
- AI description rewriting.
- AI tag generation.
- AI hashtag generation.
- Multiple title variations.
- SEO optimization.
- Suggestions to improve clarity, relevance, and curiosity without promising views or rankings.
- Content repurposing suggestions.

## Non-Goals for MVP

- YouTube video downloading.
- Audio/video downloading.
- Automated YouTube publishing.
- Automated engagement.
- Comment scraping at scale.
- Circumventing YouTube restrictions.
- Private/unavailable video access.
- Always-on browsing monitoring, accounts, cloud sync, and AI generation.
- Persistent research history and bulk extraction.

---

# 5. Target Users

## Primary

### YouTube Creators

Creators researching competitors and successful videos.

### Shorts Creators

Creators studying successful Shorts titles, descriptions and hashtags.

### YouTube Agencies

Agencies researching content strategies for clients.

### Content Researchers

People collecting metadata and content ideas from YouTube.

### SaaS / AI Creators

Creators who want to quickly feed YouTube metadata into AI tools.

---

# 6. Core User Journey

```text
User opens YouTube video
        ↓
User clicks extension
        ↓
Extension validates current video and extracts metadata
        ↓
Metadata displayed
        ↓
User edits if required
        ↓
Copy individual field OR Copy Everything
        ↓
Paste into another tool
```

---

# 7. MVP Feature Set

## 7.1 YouTube Page Detection

On popup open, validate the active tab's HTTPS hostname and parse its URL. MVP supports `www.youtube.com` and `youtube.com`; unrelated hosts and lookalike domains must be rejected. Additional query parameters must not break detection.

Supported URL patterns:

```text
youtube.com/watch?v=VIDEO_ID
youtube.com/shorts/VIDEO_ID
```

Page route and content classification are separate:

```text
pageType: watch | shorts
contentType: long | short | unknown
playbackStatus: recorded | live | upcoming | premiere | unknown
```

A `/watch` route alone does not prove that the content is long-form. Use current-video evidence for content classification; otherwise show `Video` and store `unknown`. A confirmed active Shorts page may be labeled `Short`. Never classify solely from duration.

`/live`, `/embed`, mobile YouTube, and YouTube Studio routes are outside MVP support. A `youtu.be` link is supported after it redirects to a supported page. Normalize the source URL to its supported route and video ID, removing playlist, tracking, and timestamp parameters.

If the current page is not a supported YouTube video:

```text
No YouTube video detected.

Open a YouTube video to extract metadata.
```

---

# 8. Metadata Extraction

## Core Fields

All core fields must be attempted. Missing optional or core metadata must not discard other valid fields. A successful extraction requires the current video ID and at least one available or confirmed-empty core field. A result containing only the URL is an extraction failure.

### 8.1 Title

Extract the video's current title.

Example:

```text
I Built an AI SaaS in 7 Days
```

---

### 8.2 Description

Extract the publicly available video description.

The extension should preserve:

- Line breaks
- URLs
- Hashtags
- Plain text structure; HTML formatting is not retained

Do not present a collapsed excerpt, search snippet, or truncated meta description as the full description. Use a complete source or mark the field unavailable. An explicitly empty description is a valid result.

---

### 8.3 Hashtags

Extract hashtags from the video's metadata/description where reliably identifiable.

Use the complete title and description for the current video. Support Unicode letters, combining marks, digits, and underscores, including Hindi hashtags. Preserve first-seen spelling and order, deduplicate matching hashtags, and exclude URL fragments and standalone `#` characters. If either input is unavailable, mark the hashtag result as partial using `isPartial: true`; zero matches then means unavailable, not confirmed empty.

Example:

```text
#AI
#SaaS
#Startup
```

---

### 8.4 Tags

Extract video tags only when they are publicly available through legitimate browser-accessible metadata or supported extraction methods.

If tags cannot be reliably retrieved:

```text
Tags unavailable
```

The product must never falsely claim that generated/reconstructed keywords are the video's original tags.

---

## Additional Metadata

Where available:

```text
Video URL
Video ID
Channel Name
Channel URL
Thumbnail URL
Publish Date
Duration
Views
Video Type
```

Optional fields should gracefully show:

```text
Not available
```

rather than breaking the extension.

### 8.5 Extraction Sources and Fallbacks

Build a small extraction prototype before committing to the production UI. The following is the intended source order; the prototype must record which sources actually work for each supported page type.

| Field | Preferred source | Fallback / unavailable rule |
| --- | --- | --- |
| Video ID and source URL | Validated current tab URL | Reject unsupported or invalid routes |
| Title | Structured page/player metadata matched to current video ID | Current video heading; never document title from a previous navigation |
| Description | Complete structured description matched to current video ID | Verified complete current-video description DOM; otherwise unavailable |
| Original tags | Explicit video keyword/tag list attributable to the current video | Verified video-specific tag metadata; otherwise unavailable; never infer from title or hashtags |
| Hashtags | Parse title and complete description | Preserve reliable matches with a partial indicator if an input is missing |
| Channel name and URL | Current-video owner metadata | Current-video owner link; never recommended-video or comment authors |
| Thumbnail URL | Current-video thumbnail metadata | Verified current-video image URL; do not invent a resolution URL |
| Publish date | Explicit publication date metadata | Exact date in current-video UI; relative dates are unavailable |
| Duration | Current-video numeric duration | Parse a complete duration for recorded content; do not estimate for active live or upcoming content |
| Views | Exact current-video count | Exact localized number if unambiguous; `1.2M` must not become a fabricated exact count |
| Content and playback types | Current-video type/status metadata | Active Shorts route for Short; otherwise unknown when unverified |

Rules:

- Validate video identity before extraction and again before accepting the result. Discard conflicting or stale source data.
- Ordinary content scripts run in an isolated JavaScript environment. If page-owned variables are needed, use a narrowly scoped, packaged main-world reader that returns only allowlisted, validated fields. DOM-readable structured data does not require executing page scripts.
- Do not use undocumented remote endpoints or a backend as an MVP extraction fallback. If an approved source is absent, report availability honestly.
- Each field records its source and status. Missing data must never silently become `0`, an empty string, or an empty array.
- Render extracted text as text. Never execute source HTML, scripts, or metadata.
- Source URLs, titles, and descriptions must all refer to the same video; data from inactive Shorts cards is invalid.

### 8.6 Live and Premiere Behavior

For accessible live streams and premieres on supported routes, extract available metadata and show the verified playback status. Upcoming content and active streams may have no fixed duration; show `Not available`. Concurrent viewers must not be labeled as total views. A scheduled start time must not be labeled as the publish date. Recorded replays use a known fixed duration when available.

---

# 9. Extension Popup UI

## Header

```text
TubeMeta AI
YouTube Metadata Extractor
```

Optional status:

```text
● Video Detected
```

---

## Video Information

```text
┌──────────────────────────────────┐
│ [Thumbnail]                      │
│                                  │
│ I Built an AI SaaS in 7 Days     │
│                                  │
│ Channel Name                     │
│ Long Video • 12:43               │
└──────────────────────────────────┘
```

Keep the video summary compact, collapse long descriptions initially, and keep Copy Everything visible in a sticky footer. Expanding a description changes only its display; copy always uses its complete value.

Show title/description character counts and tag/hashtag counts. Use visible keyboard focus, labeled controls, logical tab order, readable contrast, and an accessible announcement for copy results. Counts are informational and must not imply an SEO score.

---

# 10. Metadata Cards

Title, description, tags, and hashtags have dedicated cards. Other fields appear in a compact Details section. Show `Edited` for changed fields, `Partial` for incomplete extraction, and field-specific empty/unavailable/error messages.

## Title

```text
TITLE

I Built an AI SaaS in 7 Days

[Copy]
```

## Description

```text
DESCRIPTION

I built an AI SaaS from scratch...

[Copy]
```

## Tags

```text
TAGS

ai, saas, startup, coding...

[Copy]
```

## Hashtags

```text
HASHTAGS

#AI #SaaS #Startup

[Copy]
```

---

# 11. Primary CTA

The most prominent action should be:

```text
📋 COPY EVERYTHING
```

Clicking it copies structured metadata to the clipboard.

### Copy Contract

- Use the current displayed draft values, including user edits. Preserve description line breaks and URLs.
- Export all nonempty available fields in this order: title, description, tags, hashtags, video URL, video ID, channel name, channel URL, thumbnail URL, publish date, duration, views, content type, playback status, extracted at.
- Omit empty, unavailable, and errored fields; never copy UI placeholders. A numeric zero is a valid available value and must be included.
- For partially extracted hashtags, use the heading `HASHTAGS (PARTIAL)`. User-edited hashtags use the normal heading and are identified as edited in the UI.
- Use uppercase headings followed by a colon, one newline before the value, and one blank line between fields. Tags use comma-space separators; hashtags use single spaces. Trim token edges and omit blank tokens while preserving token order. Edited lists use one token per line in the editor so commas within a tag do not split it.
- Dates use `YYYY-MM-DD`; extraction timestamps use UTC ISO 8601. Duration displays as `m:ss` or `h:mm:ss`. Export exact views as an ungrouped integer.
- Export the canonical source URL and video ID even when content fields have been edited. Unknown content/playback types are omitted.
- The extracted-at timestamp identifies the source snapshot, not the time of the user's edits.
- Disable copy while the video's identity is unresolved, navigation invalidates the snapshot, or extraction has failed without a usable snapshot for this video.
- Show success only after the clipboard write succeeds. On failure, show `Couldn't copy. Try again.` and provide selectable text for manual copying.

Abbreviated example output (the full output also includes any other available fields listed above):

```text
TITLE:
I Built an AI SaaS in 7 Days

DESCRIPTION:
I built an AI SaaS from scratch...

TAGS:
ai, saas, startup, coding

HASHTAGS:
#AI #SaaS #Startup

VIDEO URL:
https://youtube.com/watch?v=XXXXXXXX

CHANNEL NAME:
Example Channel
```

After successful copy:

```text
✓ Copied to clipboard
```

---

# 12. Edit Before Copy

Users should be able to modify extracted metadata.

Example:

```text
TITLE

[ I Built an AI SaaS in 7 Days ]

[Copy]
```

The field should become editable.

This allows users to clean or customize metadata before copying.

### Draft Lifecycle

- Title, description, tags, and hashtags are editable. Source identity and factual details remain read-only.
- Store the extracted snapshot separately from edited fields. Each edit is a draft override; clearing a field is an intentional empty override.
- Save overrides as edits occur to extension-owned, session-scoped storage keyed by tab ID and video ID. A closing popup must not lose the last accepted edit.
- Reopening the popup or returning to the same video in the same tab restores its draft during the browser session. Different videos and tabs must not share overrides.
- Session drafts are cleared at browser-session end. Persistent history is a future feature. Provide a `Clear session drafts` action.
- Each edited field has `Reset to original`, which removes its override and restores the latest extracted value. A draft-level reset does the same for all editable fields.
- If storage fails, keep the current editor usable and visibly state that edits could not be saved. Do not silently claim persistence.
- Editing title or description does not silently rewrite the hashtag field. Hashtags represent the extracted snapshot until the user edits or refreshes them.

---

# 13. Copy Individual Fields

Every major field should have a copy button.

Supported:

```text
Copy Title
Copy Description
Copy Tags
Copy Hashtags
Copy URL
Copy All
```

Individual copy uses the same value and formatting rules as Copy Everything, without headings. Disable the field's copy control for an empty or unavailable value. Editable unavailable fields may be filled manually and then copied, with an `Edited` label.

---

# 14. Refresh / Re-Extract

Provide a refresh action:

```text
↻ Refresh
```

Useful when:

- YouTube navigation happens without a full browser refresh.
- Metadata changes.
- User switches videos.
- SPA navigation causes stale extension state.

Refresh replaces the source snapshot for the same video and updates unedited fields while retaining all draft overrides. Show `Refreshed; your edits were kept` when overrides exist. Reset to original uses the newly extracted source. If refresh fails, retain a same-video snapshot with a `Refresh failed; showing previous data` notice and its timestamp; never reuse another video's snapshot.

---

# 15. YouTube SPA Handling

YouTube is a Single Page Application.

The extension must correctly handle navigation such as:

```text
Video A
   ↓
Video B
   ↓
Short A
   ↓
Short B
```

without requiring the user to reload Chrome.

The extension should detect URL changes and/or relevant DOM/navigation events.

During an authorized extraction session:

- Every request includes `tabId`, `videoId`, and a monotonically increasing request ID. Only the latest matching response may update the UI.
- Invalidate the active snapshot as soon as navigation changes the video. Late results for Video A must never appear under Video B or enter its clipboard output.
- Revalidate tab/video identity immediately before a copy action; if it changed, block copying and request extraction for the current video.
- Debounce navigation bursts, bound retries, and avoid continuous polling or scanning the full page on every mutation.
- On each popup open, validate the current tab again, even when cached data or a draft exists. A hard reload must allow reinjection without duplicate listeners.
- Scope cached snapshots and drafts by tab and video. Reopening on Video B must never briefly show Video A as the current result.

Required scenarios: A → B, A → B → A, browser back/forward, watch → Shorts, rapid Shorts scrolling, two YouTube tabs, delayed responses, and reload after extension installation/update. There is no requirement to track browsing before the user invokes the extension.

---

# 16. Short Video Support

TubeMeta AI must support:

```text
youtube.com/shorts/VIDEO_ID
```

When the active Short has been verified, the UI should display:

```text
SHORT
```

and use the same extraction workflow.

Identify the active Short from the current route and matching page data. Ignore preloaded, previous, and next Shorts. An inactive card must never supply the title, owner, tags, or description.

Example:

```text
Video Type: Short

Title
Description
Hashtags
Tags
URL
Channel
Views
```

---

# 17. Error States

## Not YouTube

```text
TubeMeta AI

No YouTube video detected.

Open a YouTube video to get started.
```

## Extraction Failed

```text
We couldn't extract this video's metadata.

[Try Again]
```

## Partial Metadata

```text
Some metadata couldn't be retrieved.

Available information has been extracted.
```

## Restricted Video

```text
This video cannot be accessed.

TubeMeta AI can only extract publicly accessible information.
```

### Field and Operational States

- `empty`: confirmed no description/tags/hashtags; use a field-specific message such as `No tags provided`.
- `unavailable`: no reliable source exists for this field; use `Tags unavailable` or `Not available`.
- `error`: reading or parsing an otherwise expected field failed; preserve other available fields and allow retry.
- Loading exceeds the timeout: stop the spinner and offer retry; do not wait indefinitely.
- Access denied or injection failed: explain that page access was unavailable and offer reopening/reloading the page where appropriate.
- Clipboard and draft-storage failures use their specific messages from Sections 11 and 12.
- Restricted access is shown only when supported by page evidence, not inferred from a missing optional field.

---

# 18. Permissions

MVP uses extraction on explicit user invocation. It does not require a background detector running on every YouTube visit.

| Permission | MVP purpose |
| --- | --- |
| `activeTab` | Temporary access to the tab on which the user invokes the extension |
| `scripting` | Inject the packaged extractor into a validated supported YouTube page |
| `storage` | Session drafts and local preferences |

Use the popup's clipboard API in direct response to a user click. Add `clipboardWrite` only if the supported Chrome baseline demonstrably requires it; record that decision in the implementation notes. Do not request clipboard read access.

No persistent host permissions, `<all_urls>`, broad `tabs` permission, or static always-on content scripts are required by this MVP design. The extractor must still enforce the hostname allowlist in Section 7. If a future feature needs persistent host access, scope it to the required YouTube hosts and document its user-facing purpose.

---

# 19. Architecture

## Recommended Stack

### Extension

```text
Manifest V3
TypeScript
React
Vite
```

Alternative lightweight implementation:

```text
Manifest V3
Vanilla JavaScript
HTML/CSS
```

React is preferred if the UI is expected to grow into AI features.

MVP implementation choice: Manifest V3 + TypeScript + React + Vite. Keep extraction and copy-formatting logic independent of React. Package all runtime code with the extension. Minimum supported Chrome version must be recorded after the prototype validates the required APIs.

---

# 20. Extension Components

```text
TubeMeta AI
│
├── Background Service Worker
│
├── Content Script
│
├── Popup UI
│
├── Metadata Extractor
│
├── YouTube Page Detector
│
├── Clipboard Manager
│
└── Storage Manager
```

---

# 21. Content Script

Responsibilities:

- Detect YouTube video pages.
- Read publicly accessible page metadata.
- Extract title.
- Extract description.
- Identify hashtags.
- Collect accessible metadata.
- Detect video type.
- Respond to popup requests.
- Validate request/result identity and return typed field statuses and source information.
- Install navigation listeners only as needed after invocation; avoid duplicate listeners and unbounded observers.

The content script should not unnecessarily scrape unrelated page content.

---

# 22. Background Service Worker

Responsibilities:

- Manage extension lifecycle.
- Coordinate popup/content-script communication.
- Coordinate session state and relevant lifecycle events without monitoring browsing history.
- Use the permissions defined in Section 18.
- Manage future API communication.
- Manage AI requests in Phase 2.

Do not rely on service-worker global variables as durable state. Use extension storage for draft state so worker restarts do not lose edits. Future AI responsibilities are not part of the MVP implementation.

---

# 23. Popup

Responsibilities:

- Display extracted metadata.
- Allow editing.
- Copy fields.
- Copy all.
- Trigger refresh.
- Display extraction errors.
- Restore session drafts and show reset, refresh, and copy feedback.
- Provide an entry point to AI tools only when Phase 2 is released.

---

# 24. Data Model

The following types define the persisted extraction contract. UI formatting is derived from numeric/date values; it is not the stored source of truth.

```typescript
type FieldSource = 'structured' | 'dom' | 'derived';
type Field<T> =
  | { status: 'available'; value: T; source: FieldSource; isPartial?: boolean }
  | { status: 'empty'; value: T; source: FieldSource }
  | { status: 'unavailable'; value: null; source: null }
  | { status: 'error'; value: null; source: FieldSource | null; errorCode: string };

interface MetadataSnapshot {
  schemaVersion: 1;
  tabId: number;
  requestId: number;
  videoId: string;
  videoUrl: string;
  pageType: 'watch' | 'shorts';
  contentType: 'long' | 'short' | 'unknown';
  playbackStatus: 'recorded' | 'live' | 'upcoming' | 'premiere' | 'unknown';
  extractedAt: string; // UTC ISO 8601
  title: Field<string>;
  description: Field<string>;
  tags: Field<string[]>;
  hashtags: Field<string[]>;
  channelName: Field<string>;
  channelUrl: Field<string>;
  thumbnailUrl: Field<string>;
  publishDate: Field<string>; // YYYY-MM-DD; do not manufacture a timezone
  durationSeconds: Field<number>;
  views: Field<number>;
}

interface SessionDraft {
  tabId: number;
  videoId: string;
  updatedAt: string;
  overrides: {
    title?: string;
    description?: string;
    tags?: string[];
    hashtags?: string[];
  };
}
```

`empty` is valid only for a confirmed empty description or list. Missing numeric values use `null` with a non-available status; zero views remains available. Duration and views must be finite nonnegative numbers, with views an integer. Date-only publication values must remain date-only. Override absence means use the source; an empty override means the user intentionally cleared it. Edited values must not overwrite source provenance or masquerade as original tags.

---

# 25. Privacy

TubeMeta AI should follow a privacy-first architecture.

## MVP

Basic extraction happens locally inside the browser. No account is required.

The extension should not upload video metadata to a server merely to perform extraction.

Session snapshots and drafts stay in extension-owned storage and are not synced. Provide a clear session-data action and document session expiration. Loading a thumbnail URL may make a normal request to its image host; the local-extraction promise does not imply zero network requests.

Remote analytics is off by default and requires an explicit opt-in if shipped. Opting out must preserve all extraction and copy functionality. Video IDs, URLs, titles, descriptions, tags, channel identities, draft text, and clipboard contents must not be sent as analytics or diagnostic payloads.

## Future AI

When users explicitly invoke AI:

```text
Extracted metadata
        ↓
User clicks AI feature
        ↓
Metadata sent to selected AI API
        ↓
AI response
        ↓
Displayed in extension
```

Clearly disclose that AI features may process the selected metadata.

Before the first AI request, show which selected fields and user-provided context will be sent and identify the processing provider. Send only the data needed for the chosen action. Document retention and deletion behavior before releasing AI features.

---

# 26. Phase 2 — AI Layer

The AI layer is the main future monetization opportunity.

Phase 2 starts after extraction and copy reliability meet the MVP release criteria and initial users demonstrate repeat use. AI output is a suggestion; do not promise rankings, virality, or increased views.

Require the user's own video topic or brief, target audience, and output language, with optional tone and CTA. Let users select reference fields. Keep source metadata, user context, and AI output separate. Generated output may replace a draft only through an explicit user action.

AI must not invent achievements, product claims, links, or facts absent from the user's brief. Treat extracted text as untrusted reference content rather than instructions. Failed/cancelled requests and duplicate retries must not consume additional credits for an undelivered result.

Add:

```text
✨ AI REWRITE
```

---

# 27. AI Title Rewriter

Input:

```text
Original Title:
I Built an AI SaaS in 7 Days
```

User selects:

```text
Generate Titles
```

Options:

```text
🔥 Engaging
🎯 SEO
😲 Curiosity
💼 Professional
⚡ Short
🇮🇳 Hindi
🇺🇸 English
```

Output:

```text
1. I Built an AI SaaS in Just 7 Days
2. How I Built an AI SaaS From Scratch
3. I Built a SaaS With AI in 7 Days
4. Building an AI SaaS From Zero to Launch
5. I Tried Building an AI SaaS in One Week
```

---

# 28. AI Description Rewriter

Actions:

```text
Rewrite Description
Improve SEO
Make More Engaging
Shorten
Expand
Add CTA
```

---

# 29. AI Tag Generator

Generate relevant tags based on:

- Title
- Description
- Video topic

Label these `AI-generated tags`, separate from the video's original tags. Tag suggestions are a convenience feature, not a guaranteed ranking improvement. YouTube states that tags play a minimal role in discovery except cases such as common misspellings; see Section 44.

Example:

```text
ai saas
ai startup
build saas
saas business
ai tools
startup ideas
```

---

# 30. AI Hashtag Generator

Example:

```text
#AI
#SaaS
#Startup
#AITools
#Entrepreneurship
```

---

# 31. Generate Better Version

A premium AI workflow:

```text
Original Video Metadata
          ↓
Analyze
          ↓
AI Content Optimization
          ↓
Better Title
Better Description
Better Tags
Better Hashtags
          ↓
Copy / Export
```

This can become TubeMeta AI's premium feature.

---

# 32. Future Features

Potential roadmap:

### V3

- Optional side panel for longer editing and research sessions.
- Competitor comparison.
- Save analyzed videos.
- Metadata history.
- Collections.
- Search saved videos.
- Export CSV.
- Export JSON.
- Share metadata.
- AI content brief.
- Keyword suggestions.
- Title scoring.
- Description scoring.

### V4

- Channel analysis.
- Analyze multiple videos.
- Viral pattern detection.
- Topic extraction.
- Thumbnail analysis.
- Content gap detection.
- Next-video recommendations.
- AI script generation.
- Direct integration with creator tools.

---

# 33. Monetization

## Free

```text
Unlimited basic metadata extraction
Copy Title
Copy Description
Copy Tags
Copy Hashtags
Copy Everything
```

Basic extraction and copy remain free without login. An AI trial allowance is a Phase 2 experiment; its size must be chosen from observed generation costs and abuse controls before release.

## Pro

Pricing hypothesis, subject to cost and demand validation:

```text
$9/month
```

Includes:

- A clearly displayed monthly AI credit allowance
- Title generation
- Description optimization
- Tag generation
- Hashtag generation
- SEO optimization
- Saved history
- Advanced AI tools

Define credits per action, input/output limits, reset date, and exhausted-credit behavior before checkout. Meter usage on the backend, deduplicate retries, and rate-limit abuse. Choose an allowance only after measuring representative cost per delivered generation and setting a sustainable margin. Saved history and other roadmap features must not appear as included until shipped.

## Lifetime / One-Time Offer

Potential:

```text
$49 – $79
```

Could be tested after product-market validation. A one-time license must not promise unlimited lifetime third-party AI usage; recurring AI consumption requires separately defined credits or a subscription. These prices are hypotheses, not launch commitments.

---

# 34. Analytics

Follow the opt-in and content-exclusion rules in Section 25. Remote analytics is optional infrastructure and is not required for local extraction. If it is not implemented, use aggregate store installation counts and consented beta feedback; do not claim unmeasured user conversion or retention.

Useful events:

```text
extension_installed
popup_opened
video_detected
metadata_extracted
extraction_failed
copy_title
copy_description
copy_tags
copy_hashtags
copy_all
copy_failed
ai_rewrite_clicked
ai_generation_completed
upgrade_clicked
```

Record copy events only after successful clipboard writes. Allowlisted event properties: extension version, coarse page type, available-field count, controlled error code, and latency bucket. Never send arbitrary exception text or page-derived strings.

For opted-in cohort measurement, use a random installation identifier with no account identity or cross-product tracking, retain raw events for at most 30 days, and provide an opt-out that stops collection and deletes the local identifier. Document server deletion and aggregate retention before enabling collection. Report cohort size and opt-in bias alongside metrics. An installation event may be sent only after consent, using the locally recorded install timestamp.

---

# 35. Chrome Web Store Positioning

## Product Name

**TubeMeta AI**

## Short Description

> Copy available YouTube titles, descriptions, tags and hashtags in one click.

## Long Description Concept

TubeMeta AI helps YouTube creators instantly extract and reuse video metadata.

Open a supported YouTube video or Short, click TubeMeta AI, and get its available title, description, tags, hashtags and video information. Some fields may be unavailable.

Copy individual fields or copy everything with one click.

MVP messaging emphasizes extraction, editing, and copying. The name may remain TubeMeta AI, but the listing and screenshots must make clear that AI generation is not included in this release. Avoid active-looking AI buttons until the feature ships.

---

# 36. MVP Success Metrics

These are initial hypotheses for consented beta/analytics cohorts. They do not substitute for the release checks in Section 42.

### Installation

- 100 installs
- 500 installs
- 1,000 installs

### Activation

Percentage of eligible opted-in installations that complete at least one successful individual-field or Copy Everything action within 24 hours of installation:

```text
Install
↓
Open YouTube
↓
Extract metadata
↓
Successfully copy a field or Copy Everything
```

Target:

```text
Initial target: >= 60%
```

Use installations whose full 24-hour observation window has elapsed and whose measurement consent covered that window. Report excluded/late-consent installations separately. If that cohort cannot be measured, report time from first observed popup open to first successful copy as a separate metric, not install activation.

### Core Engagement

Measure successful-copy sessions divided by sessions with a detected supported video. Initial target: >= 80%. Define a session as activity separated by less than 30 minutes of inactivity. Track individual copy and Copy Everything as equally valid outcomes; their relative usage is diagnostic, not a success gate.

### Retention

Measure another successful copy on Day 1, Day 7, and Day 30 after activation, using 24-hour UTC windows. Also measure repeat use in days 7–13; initial week-two repeat-use target: >= 25% of activated installations with a complete observation window.

Track extraction failure rate and per-field availability separately. Missing tags must not count as a total extraction failure. Correctness is evaluated against reviewed source evidence in the release corpus, not inferred from an extraction-success event.

---

# 37. Performance Requirements

Proposed release targets, measured with a production build on a documented reference machine and minimum supported Chrome version:

- Popup shell is interactive within 300 ms at the 95th percentile, measured from popup document initialization; measure first-open and subsequent-open cases separately.
- On a ready supported video page, the extraction result is visible within 2 seconds at the 95th percentile from the extraction request. A ready page has the current video identity and its metadata loaded.
- Loading pages use a bounded retry budget and finish with a result or actionable error within 5 seconds. No infinite spinners.
- Copy confirmation appears within 300 ms at the 95th percentile after a click when clipboard access is permitted.
- No continuous background polling. Disconnect unused observers and prevent listener accumulation across navigation.
- No extension-attributable page main-thread task over 50 ms during the documented extraction sample. Record memory before/after repeated navigation and investigate retained growth.

Use at least 100 ready-page extraction runs split between watch and Shorts routes, with cold and warm cases reported separately. Record machine/browser details, corpus, and measured percentiles. These targets remain unverified until the prototype and production checks run.

---

# 38. Security Requirements

- Follow Chrome Manifest V3 requirements.
- Minimize permissions.
- Never execute arbitrary remote code.
- Sanitize extracted HTML before rendering.
- Escape user-controlled content.
- Never expose API keys in client-side code.
- AI API keys should be handled through a secure backend when required.
- Validate all AI/API responses.
- Protect backend endpoints against abuse and rate-limit requests.
- Validate extension message sender, payload schema, field sizes, and current request/video identity.
- Treat main-world reader output as untrusted data; do not expose privileged extension commands through a page bridge.
- Render metadata as plain text and allow only validated HTTPS URLs for external links and thumbnails.
- Keep error reporting free of page content and user edits.

---

# 39. MVP Development Plan

## Sprint 0 — Extraction Feasibility

- Build a minimal extension prototype before the polished UI.
- Validate full descriptions, original tags, active Shorts identity, and watch/Shorts navigation with the permission model in Section 18.
- Record source availability by field and route, including logged-in/out cases and Hindi/English pages.
- Confirm the minimum Chrome version and clipboard permission decision.
- Gate: demonstrate trustworthy core extraction on both supported routes. If a field cannot be reliably obtained, explicitly document its availability limitation before UI implementation; never fill the gap with inferred original metadata.

## Sprint 1 — Foundation

- Create Chrome extension.
- Manifest V3.
- React + TypeScript + Vite.
- Popup UI.
- YouTube detection.
- Basic messaging architecture.
- Typed field states, request identity, and session draft storage.

## Sprint 2 — Extraction

Implement:

```text
Title
Description
Hashtags
URL
Channel
Thumbnail
Duration
Views
Publish Date
Video Type
```

Add tag extraction only where technically/reliably available.

Implement stale-response rejection, source provenance, full-description checks, and live/premiere behavior during this sprint. Shorts and SPA correctness are extraction foundations, not deferred UI work.

## Sprint 3 — UX

- Metadata cards.
- Editable fields.
- Copy buttons.
- Copy Everything.
- Refresh.
- Loading state.
- Error states.
- Short support.
- SPA navigation.
- Draft restore, refresh-with-edits, reset, and storage failure feedback.
- Exact copy contract, counts, keyboard controls, and accessible status messages.

## Sprint 4 — Testing

Test:

```text
Long video
Short
Private/restricted video
Live video
Premiere
Missing description
Very long description
No hashtags
Different YouTube layouts
SPA navigation
Dark mode
Light mode
```

Use a documented corpus of at least 30 accessible videos covering both routes and the relevant states above. Include Hindi/English text, Unicode hashtags, confirmed-empty fields, unavailable tags, abbreviated views, and full descriptions with timestamps and URLs. Use captured fixtures for rare/error states when live examples cannot be reproduced reliably.

Required regression scenarios:

- Rapid navigation with deliberately delayed/out-of-order extraction responses; no video identity mixing.
- Back/forward, multiple tabs, extension reload, and service-worker restart.
- Popup close immediately after an edit, reopen, return to a previous video, refresh with edits, and reset to latest source.
- Exact individual and full clipboard output, omitted unavailable fields, intentional empty edits, zero views, and clipboard denial.
- Draft storage failure and session expiration.
- Accessible live/upcoming/premiere/replay metadata without mislabeling duration, publish date, or concurrent viewers.
- Permission denial, unsupported domains/routes, restricted videos, page loading timeout, and partial metadata.
- Keyboard operation, screen-reader status feedback, and long-text layout.

Compare fields against reviewed source evidence and record expected availability. A correct unavailable state passes; fabricated or mismatched data fails. Publish a validation report with corpus results and Section 37 measurements.

## Sprint 5 — Chrome Web Store

- Icon.
- Screenshots.
- Store description.
- Privacy policy.
- Permission review.
- Production build.
- Publish.

---

# 40. Future Technical Architecture

```text
                 YouTube
                    │
                    ▼
             Content Script
                    │
                    ▼
           Metadata Extractor
                    │
                    ▼
              Popup UI
             /         \
            /           \
       Copy Data       AI Tools
                         │
                         ▼
                    API Backend
                         │
                         ▼
                    AI Provider
                         │
                         ▼
                 Optimized Metadata
```

---

# 41. Product Principles

TubeMeta AI should always prioritize:

1. **Speed**
2. **Accuracy**
3. **Simplicity**
4. **Privacy**
5. **Creator workflow**
6. **One-click actions**

The user should never need to understand how the extraction works.

The product experience should feel like:

> Open YouTube → Click TubeMeta → Get everything.

---

# 42. MVP Definition of Done

The MVP is ready when:

- [ ] Extension installs successfully.
- [ ] YouTube video is detected.
- [ ] YouTube Short is detected.
- [ ] Title is extracted.
- [ ] Description is extracted.
- [ ] Hashtags are extracted.
- [ ] Publicly accessible tags are extracted when available.
- [ ] Video URL is extracted.
- [ ] Channel name is extracted.
- [ ] Thumbnail is extracted.
- [ ] Video type is identified.
- [ ] Duration is extracted where available.
- [ ] Views are extracted where available.
- [ ] Publish date is extracted where available.
- [ ] User can edit fields.
- [ ] User can copy individual fields.
- [ ] User can copy everything.
- [ ] SPA navigation works.
- [ ] Loading state works.
- [ ] Error state works.
- [ ] No unnecessary permissions are requested.
- [ ] No API key is exposed.
- [ ] Chrome Web Store build passes production testing.

In addition to the feature checklist, all of the following release gates must pass:

- [ ] Sprint 0 records working sources, known availability limits, minimum Chrome version, and final permission choices.
- [ ] At least 95% of eligible ready-page cases in the documented corpus return the correct current title and complete description or a confirmed-empty description. Track unavailable descriptions as misses for this core-coverage gate.
- [ ] Zero wrong-video, mixed-video, or fabricated original-tag results in the navigation and extraction corpus.
- [ ] Missing, empty, partial, and errored fields follow the data contract and preserve usable metadata.
- [ ] Live/Premiere cases and unknown content types display without invented values.
- [ ] Drafts survive popup closure and worker restart during the session; refresh preserves edits and reset restores the latest source.
- [ ] Individual and full copy outputs match Section 11, including manual edits and clipboard failure behavior.
- [ ] Character counts, token counts, keyboard controls, and accessible feedback work.
- [ ] Section 37 performance targets are met in a recorded production-build report.
- [ ] Network inspection confirms no extraction uploads or content-bearing analytics; remote analytics is off by default.
- [ ] Session-data clearing works and privacy documentation matches implemented storage and telemetry behavior.
- [ ] Store listing accurately describes shipped functionality and field availability.

These are future implementation checks. Updating this PRD does not mark any gate as completed.

---

# 43. Final Product Direction

TubeMeta AI should not remain only a metadata copier.

The long-term product should evolve into:

> **TubeMeta AI — YouTube Content Intelligence & Optimization Assistant**

The progression should be:

```text
STEP 1
Extract
   ↓
STEP 2
Copy
   ↓
STEP 3
Rewrite
   ↓
STEP 4
Optimize
   ↓
STEP 5
Analyze
   ↓
STEP 6
Recommend
   ↓
STEP 7
Create
```

This creates a natural product expansion from a simple Chrome extension into a broader creator intelligence platform.

---

# 44. Technical References and Review Notes

Official references used for this revision:

- [Chrome popup behavior](https://developer.chrome.com/docs/extensions/develop/ui/add-popup): popups close when focus moves outside, motivating session draft storage.
- [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts): isolated execution environments and content script injection options.
- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab): temporary access following explicit user invocation.
- [YouTube tag guidance](https://support.google.com/youtube/answer/146402?hl=en): tags have a limited discovery role; product copy must not promise ranking gains.

Implementation validation still required: actual YouTube source availability, completeness of descriptions, original-tag availability, minimum supported browser version, clipboard permission needs, and measured performance. Recheck official platform requirements during implementation and before store submission.
