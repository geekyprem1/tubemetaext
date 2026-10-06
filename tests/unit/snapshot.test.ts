import { describe, expect, it } from 'vitest';
import { buildMetadataSnapshot } from '../../src/background/snapshot';
import type { DomCandidates } from '../../src/content/readers/video-dom';
import type { PlayerReaderResult } from '../../src/content/readers/main-world';
import { isMetadataSnapshot } from '../../src/domain/validation';
import type { VideoTarget } from '../../src/domain/youtube-url';

const videoId = 'dQw4w9WgXcQ';

const watchTarget: VideoTarget = {
  videoId,
  pageType: 'watch',
  canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
};

const shortsTarget: VideoTarget = {
  videoId,
  pageType: 'shorts',
  canonicalUrl: `https://www.youtube.com/shorts/${videoId}`,
};

function makeReader(overrides: Partial<PlayerReaderResult> = {}): PlayerReaderResult {
  return {
    ok: true,
    videoId,
    title: 'Source title',
    description: 'Source description',
    keywords: ['one', 'two'],
    keywordsPresent: true,
    channelName: 'Channel',
    channelUrl: 'http://www.youtube.com/@channel',
    thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg',
    durationSeconds: 213,
    views: 42,
    publishDate: '2025-01-02',
    live: { isUpcoming: false, isLiveNow: false, isLiveContent: false },
    playabilityStatus: 'OK',
    ...overrides,
  };
}

function makeDom(overrides: Partial<DomCandidates> = {}): DomCandidates {
  return {
    title: null,
    descriptionExcerpt: null,
    channelName: null,
    channelUrl: null,
    thumbnailUrl: null,
    viewsText: null,
    publishDateMeta: null,
    mediaDurationSeconds: null,
    ...overrides,
  };
}

function build(readerOverrides: Partial<PlayerReaderResult> = {}, dom: DomCandidates | null = null) {
  return buildMetadataSnapshot({
    tabId: 5,
    requestId: 1,
    target: watchTarget,
    reader: makeReader(readerOverrides),
    dom,
    extractedAt: '2026-10-05T18:00:00.000Z',
  });
}

describe('buildMetadataSnapshot', () => {
  it('builds a validated snapshot from the structured source with derived hashtags', () => {
    const result = build({ title: 'Title #One #Two', description: 'Body #हिंदी' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(isMetadataSnapshot(result.snapshot)).toBe(true);
    expect(result.snapshot).toMatchObject({
      schemaVersion: 1,
      tabId: 5,
      requestId: 1,
      videoId,
      videoUrl: watchTarget.canonicalUrl,
      pageType: 'watch',
      contentType: 'unknown',
      playbackStatus: 'recorded',
      extractedAt: '2026-10-05T18:00:00.000Z',
      title: { status: 'available', value: 'Title #One #Two', source: 'structured' },
      hashtags: { status: 'available', value: ['#One', '#Two', '#हिंदी'], source: 'derived' },
      channelUrl: { status: 'available', value: 'https://www.youtube.com/@channel' },
      views: { status: 'available', value: 42 },
    });
  });

  it('falls back to DOM candidates only where the structured source is unusable', () => {
    const result = build(
      {
        title: null,
        channelName: null,
        channelUrl: null,
        thumbnailUrl: null,
        publishDate: null,
        durationSeconds: null,
        views: null,
      },
      makeDom({
        title: 'DOM title',
        descriptionExcerpt: 'excerpt that must never be used as a description',
        channelName: 'DOM channel',
        channelUrl: 'https://www.youtube.com/@domchannel',
        publishDateMeta: '2009-10-24T23:57:33-07:00',
        viewsText: '1,823,562,145 views',
        mediaDurationSeconds: 212.7,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.snapshot.title).toEqual({ status: 'available', value: 'DOM title', source: 'dom' });
    expect(result.snapshot.channelName).toEqual({
      status: 'available',
      value: 'DOM channel',
      source: 'dom',
    });
    expect(result.snapshot.channelUrl).toEqual({
      status: 'available',
      value: 'https://www.youtube.com/@domchannel',
      source: 'dom',
    });
    expect(result.snapshot.publishDate).toEqual({
      status: 'available',
      value: '2009-10-24',
      source: 'dom',
    });
    expect(result.snapshot.durationSeconds).toEqual({
      status: 'available',
      value: 213,
      source: 'dom',
    });
    expect(result.snapshot.views).toEqual({
      status: 'available',
      value: 1823562145,
      source: 'dom',
    });
    expect(result.snapshot.thumbnailUrl.status).toBe('unavailable');
  });

  it('never treats the collapsed DOM excerpt as a description', () => {
    const result = build({ description: null }, makeDom({ descriptionExcerpt: 'Collapsed excerpt' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.description).toEqual({ status: 'unavailable', value: null, source: null });
  });

  it('rejects URL-only results as NO_CORE_METADATA', () => {
    const result = build({ title: null, description: null, keywords: null, keywordsPresent: false });
    expect(result).toEqual({ ok: false, code: 'NO_CORE_METADATA' });
  });

  it('keeps a confirmed-empty description as core evidence', () => {
    const result = build({ title: null, description: '', keywords: null, keywordsPresent: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.description).toEqual({ status: 'empty', value: '', source: 'structured' });
  });

  it('suppresses duration and views for live content and keeps zero views available', () => {
    const live = build({
      live: { isUpcoming: false, isLiveNow: true, isLiveContent: true },
      durationSeconds: 300,
      views: 500,
    });
    expect(live.ok).toBe(true);
    if (!live.ok) return;
    expect(live.snapshot.playbackStatus).toBe('live');
    expect(live.snapshot.durationSeconds.status).toBe('unavailable');
    expect(live.snapshot.views.status).toBe('unavailable');

    const zero = build({ views: 0 });
    expect(zero.ok).toBe(true);
    if (!zero.ok) return;
    expect(zero.snapshot.views).toEqual({ status: 'available', value: 0, source: 'structured' });
  });

  it('maps shorts targets to the short content type', () => {
    const result = buildMetadataSnapshot({
      tabId: 5,
      requestId: 2,
      target: shortsTarget,
      reader: makeReader(),
      dom: null,
      extractedAt: '2026-10-05T18:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.contentType).toBe('short');
    expect(result.snapshot.pageType).toBe('shorts');
  });

  it('guards identity before building', () => {
    const mismatched = buildMetadataSnapshot({
      tabId: 5,
      requestId: 1,
      target: watchTarget,
      reader: makeReader({ videoId: 'abcdefghijk' }),
      dom: null,
      extractedAt: '2026-10-05T18:00:00.000Z',
    });
    expect(mismatched).toEqual({ ok: false, code: 'VIDEO_CHANGED' });

    const failed = buildMetadataSnapshot({
      tabId: 5,
      requestId: 1,
      target: watchTarget,
      reader: { ok: false, reason: 'PLAYER_ID_MISMATCH' },
      dom: null,
      extractedAt: '2026-10-05T18:00:00.000Z',
    });
    expect(failed).toEqual({ ok: false, code: 'READER_FAILED' });
  });
});
