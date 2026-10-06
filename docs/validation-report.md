# TubeMeta AI — Live validation report (T020)

**Captured:** 2026-10-05T19:32:29.356Z  
**Build:** production `dist/` (reader source extracted from `dist/worker.js`)  
**Browser:** agent-browser bundled Chrome 153.0.8010.52, headless, fresh profile, signed out  

## Method

Each corpus page was loaded in a real Chrome, then the shipped `readCurrentPlayerResponse` (extracted from the built worker) ran in the page main world; snapshots were built with the real `buildMetadataSnapshot`. Source evidence: the page-visible title (watch `h1` / Shorts view-model), `og:title`, and — for a sample — the expanded description text. The Phase 0 log records the complete-description proof (player response vs collapsed DOM excerpt).

## Corpus

- Videos captured: 34 (watch 12, shorts 22)
- Queries harvested from: music video, hindi news, cooking recipe
- Video-ID identity matches: 34/34
- Title correct on both evidence sources: 34/34 (100.0%)
- Descriptions: 26 available, 8 confirmed empty, 0 unavailable
- Expanded-description sample proof: 6/6
- Core coverage (title + complete/empty description): 34/34 (100.0%)
- Player keywords: 23 present (labeled candidates), 11 absent (kept unavailable, never empty)
- Devanagari content observed: titles 12, descriptions 12
- Live/upcoming pages encountered: 1

## Per-video results

| videoId | route | title vs evidence | description | id match |
| --- | --- | --- | --- | --- |
| hoU4tzn-B2s | shorts | ok | confirmed empty | yes |
| Wk_iSzkCTXw | shorts | ok | 1873 chars | yes |
| MyZpl79YAIM | shorts | ok | 84 chars | yes |
| XjmfYfHNWZc | shorts | ok | confirmed empty | yes |
| 1CQQOachFKc | shorts | ok | 769 chars | yes |
| 82-jTNka3uc | watch | ok | 2461 chars | yes |
| B402rKl4bUg | watch | ok | 2705 chars | yes |
| ko70cExuzZM | watch | ok | 1077 chars | yes |
| rRjtTx49hkc | watch | ok | 272 chars | yes |
| DJ5L3yF6QLo | shorts | ok | 287 chars | yes |
| x_QxgJTL-mU | shorts | ok | confirmed empty | yes |
| gIAOB5MUr5s | shorts | ok | confirmed empty | yes |
| OZU2fSpJHkw | shorts | ok | 654 chars | yes |
| AjzTA_XS0pg | shorts | ok | confirmed empty | yes |
| cJ-Sgz-YFTg | watch | ok | 980 chars | yes |
| lj0bxzUXLqs | watch | ok | 2089 chars | yes |
| LsDbR2Ji8LI | watch | ok | 1403 chars | yes |
| CdxaTFkuGSI | watch | ok | 1075 chars | yes |
| aBY9I8CNSig | shorts | ok | 2488 chars | yes |
| uItMW9-OReo | shorts | ok | 2772 chars | yes |
| byfn7nmWj50 | shorts | ok | 1759 chars | yes |
| YRpL3EQCQWg | shorts | ok | 549 chars | yes |
| gJ3Zh_JP7FY | shorts | ok | 1607 chars | yes |
| ufWHl4bcH_U | watch | ok | 1201 chars | yes |
| ywHfh4sU1Yo | watch | ok | 1638 chars | yes |
| epLEUVaClKM | watch | ok | 3310 chars | yes |
| Lb8e7JnoHsc | shorts | ok | 1462 chars | yes |
| -fXxM_H-3ss | shorts | ok | 3559 chars | yes |
| TINg-cj1rZs | shorts | ok | 331 chars | yes |
| OIwC6Jv55Hk | shorts | ok | 33 chars | yes |
| F8WTqqLZqaA | shorts | ok | confirmed empty | yes |
| LV3mChwupF8 | shorts | ok | confirmed empty | yes |
| uWoB0_3wSrY | shorts | ok | confirmed empty | yes |
| mhDJNfV7hjk | watch | ok | 386 chars | yes |

## Findings and gaps

- No mismatches or failures were observed in this run.
- Logged-in pages, scheduled premieres, and age-restricted videos were not covered in this automated run (signed-out profile); the data model keeps those states honest when they appear (unknown types are omitted, tags stay unavailable).
- Navigation race cases (A → B → A, back/forward, rapid Shorts, reload, multi-tab) are covered by the T019 coordinator suite and the T017 live end-to-end run.
- The extraction → edit → reset → copy flow was verified live on the production build (T017 report entry).
- Lifecycle outcomes: `docs/lifecycle-checks.md`; performance sample: `docs/performance-report.md`; security and network boundary audit: `docs/security-audit.md`.

## Gates

- Titles ≥ 95%: PASS (100.0%)
- Core coverage ≥ 95%: PASS (100.0%)
- Wrong/mixed video results: 0 (PASS)
- Fabricated original tags: structurally impossible (tags render only from an explicit current-video keywords array); 0 observed.
