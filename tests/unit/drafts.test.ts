import { describe, expect, it } from 'vitest';
import { hasOverrides, projectDraft } from '../../src/domain/drafts';
import type { MetadataSnapshot } from '../../src/domain/metadata';

function makeSnapshot(overrides: Partial<MetadataSnapshot> = {}): MetadataSnapshot {
  return {
    schemaVersion: 1,
    tabId: 4,
    requestId: 2,
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    pageType: 'watch',
    contentType: 'unknown',
    playbackStatus: 'unknown',
    extractedAt: '2026-10-05T18:00:00.000Z',
    title: { status: 'available', value: 'Source title', source: 'structured' },
    description: { status: 'empty', value: '', source: 'structured' },
    tags: { status: 'unavailable', value: null, source: null },
    hashtags: { status: 'available', value: ['#AI'], source: 'derived', isPartial: true },
    channelName: { status: 'available', value: 'Channel', source: 'structured' },
    channelUrl: { status: 'available', value: 'https://www.youtube.com/@x', source: 'structured' },
    thumbnailUrl: { status: 'available', value: 'https://i.ytimg.com/vi/x/hq.jpg', source: 'structured' },
    publishDate: { status: 'available', value: '2025-01-02', source: 'structured' },
    durationSeconds: { status: 'available', value: 60, source: 'structured' },
    views: { status: 'available', value: 0, source: 'structured' },
    ...overrides,
  };
}

describe('projectDraft', () => {
  it('projects source values with status and partial markers when no overrides exist', () => {
    const projection = projectDraft(makeSnapshot(), {});

    expect(projection.title).toEqual({
      value: 'Source title',
      edited: false,
      sourceStatus: 'available',
      isPartial: false,
    });
    expect(projection.description.value).toBe('');
    expect(projection.description.sourceStatus).toBe('empty');
    expect(projection.tags).toEqual({
      value: null,
      edited: false,
      sourceStatus: 'unavailable',
      isPartial: false,
    });
    expect(projection.hashtags.isPartial).toBe(true);
    expect(projection.hashtags.edited).toBe(false);
  });

  it('lets overrides win and marks fields edited without touching other fields', () => {
    const projection = projectDraft(makeSnapshot(), { title: 'Mine', hashtags: ['#Mine'] });

    expect(projection.title).toEqual({
      value: 'Mine',
      edited: true,
      sourceStatus: 'available',
      isPartial: false,
    });
    expect(projection.hashtags).toEqual({
      value: ['#Mine'],
      edited: true,
      sourceStatus: 'available',
      isPartial: false,
    });
    expect(projection.description.edited).toBe(false);
    expect(projection.description.sourceStatus).toBe('empty');
  });

  it('distinguishes an intentionally empty override from an empty source value', () => {
    const projection = projectDraft(makeSnapshot(), { title: '', tags: [] });

    expect(projection.title.value).toBe('');
    expect(projection.title.edited).toBe(true);
    expect(projection.description.value).toBe('');
    expect(projection.description.edited).toBe(false);
    expect(projection.tags.value).toEqual([]);
    expect(projection.tags.edited).toBe(true);
  });
});

describe('hasOverrides', () => {
  it('treats empty strings and empty lists as present overrides', () => {
    expect(hasOverrides({})).toBe(false);
    expect(hasOverrides({ title: '' })).toBe(true);
    expect(hasOverrides({ tags: [] })).toBe(true);
    expect(hasOverrides({ description: 'text' })).toBe(true);
  });
});
