import { describe, expect, it } from 'vitest';
import {
  isMetadataSnapshot,
  isSessionDraft,
  isStoredRecord,
} from '../../src/domain/validation';

const videoId = 'dQw4w9WgXcQ';

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    tabId: 12,
    requestId: 3,
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    pageType: 'watch',
    contentType: 'unknown',
    playbackStatus: 'unknown',
    extractedAt: '2026-10-05T18:00:00.000Z',
    title: { status: 'available', value: 'Example title', source: 'structured' },
    description: { status: 'empty', value: '', source: 'structured' },
    tags: { status: 'unavailable', value: null, source: null },
    hashtags: { status: 'available', value: ['#AI'], source: 'derived', isPartial: true },
    channelName: { status: 'available', value: 'Example channel', source: 'structured' },
    channelUrl: {
      status: 'available',
      value: 'https://www.youtube.com/@example',
      source: 'structured',
    },
    thumbnailUrl: {
      status: 'available',
      value: 'https://i.ytimg.com/vi/x/hq.jpg',
      source: 'structured',
    },
    publishDate: { status: 'available', value: '2009-10-24', source: 'structured' },
    durationSeconds: { status: 'available', value: 213, source: 'structured' },
    views: { status: 'available', value: 0, source: 'structured' },
    ...overrides,
  };
}

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    tabId: 12,
    videoId,
    updatedAt: '2026-10-05T18:05:00.000Z',
    overrides: {},
    ...overrides,
  };
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    snapshot: makeSnapshot(),
    draft: makeDraft(),
    revision: 0,
    ...overrides,
  };
}

describe('isMetadataSnapshot', () => {
  it('accepts a well-formed snapshot including zero views and a fractional duration', () => {
    expect(isMetadataSnapshot(makeSnapshot())).toBe(true);
    expect(
      isMetadataSnapshot(
        makeSnapshot({ durationSeconds: { status: 'available', value: 12.5, source: 'structured' } }),
      ),
    ).toBe(true);
  });

  it('rejects inconsistent identity between videoId, videoUrl, and pageType', () => {
    expect(isMetadataSnapshot(makeSnapshot({ videoId: 'abcdefghijk' }))).toBe(false);
    expect(isMetadataSnapshot(makeSnapshot({ pageType: 'shorts' }))).toBe(false);
    expect(isMetadataSnapshot(makeSnapshot({ videoUrl: 'http://www.youtube.com/watch?v=' + videoId }))).toBe(false);
  });

  it('rejects malformed field states and invalid numeric/date values', () => {
    expect(
      isMetadataSnapshot(makeSnapshot({ views: { status: 'available', value: -1, source: 'structured' } })),
    ).toBe(false);
    expect(
      isMetadataSnapshot(makeSnapshot({ views: { status: 'available', value: 1.5, source: 'structured' } })),
    ).toBe(false);
    expect(
      isMetadataSnapshot(makeSnapshot({ title: { status: 'available', value: 'x', source: 'made-up' } })),
    ).toBe(false);
    expect(isMetadataSnapshot(makeSnapshot({ title: { status: 'available', source: 'structured' } }))).toBe(false);
    expect(
      isMetadataSnapshot(makeSnapshot({ publishDate: { status: 'available', value: '24-10-2009', source: 'structured' } })),
    ).toBe(false);
    expect(
      isMetadataSnapshot(makeSnapshot({ extractedAt: '2026-10-05 18:00' })),
    ).toBe(false);
  });

  it('rejects unsafe URLs', () => {
    expect(
      isMetadataSnapshot(
        makeSnapshot({ channelUrl: { status: 'available', value: 'http://www.youtube.com/@a', source: 'structured' } }),
      ),
    ).toBe(false);
    expect(
      isMetadataSnapshot(
        makeSnapshot({ channelUrl: { status: 'available', value: 'https://evil.test/@a', source: 'structured' } }),
      ),
    ).toBe(false);
    expect(
      isMetadataSnapshot(
        makeSnapshot({ thumbnailUrl: { status: 'available', value: 'https://evil.test/x.jpg', source: 'structured' } }),
      ),
    ).toBe(false);
  });

  it('rejects unknown keys and wrong schema versions', () => {
    expect(isMetadataSnapshot(makeSnapshot({ extra: true }))).toBe(false);
    expect(isMetadataSnapshot(makeSnapshot({ schemaVersion: 2 }))).toBe(false);
  });
});

describe('isSessionDraft', () => {
  it('accepts absent and empty overrides as distinct states', () => {
    expect(isSessionDraft(makeDraft())).toBe(true);
    expect(isSessionDraft(makeDraft({ overrides: { title: '' } }))).toBe(true);
    expect(isSessionDraft(makeDraft({ overrides: { tags: [] } }))).toBe(true);
  });

  it('rejects unknown override keys and malformed values', () => {
    expect(isSessionDraft(makeDraft({ overrides: { thumbnailUrl: 'x' } }))).toBe(false);
    expect(isSessionDraft(makeDraft({ overrides: { tags: 'not-a-list' } }))).toBe(false);
    expect(isSessionDraft(makeDraft({ videoId: 'short' }))).toBe(false);
    expect(isSessionDraft(makeDraft({ updatedAt: 'not-a-timestamp' }))).toBe(false);
  });
});

describe('isStoredRecord', () => {
  it('accepts a consistent record and rejects cross-entity mismatches', () => {
    expect(isStoredRecord(makeRecord())).toBe(true);
    expect(isStoredRecord(makeRecord({ draft: makeDraft({ videoId: 'abcdefghijk' }) }))).toBe(false);
    expect(isStoredRecord(makeRecord({ revision: -1 }))).toBe(false);
    expect(isStoredRecord(makeRecord({ revision: undefined, extra: 1 }))).toBe(false);
  });
});
