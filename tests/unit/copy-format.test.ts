import { describe, expect, it } from 'vitest';
import {
  buildCopyEverything,
  formatHashtagsValue,
  formatTagsValue,
  individualCopyText,
} from '../../src/domain/copy-format';
import { projectDraft } from '../../src/domain/drafts';
import type { MetadataSnapshot } from '../../src/domain/metadata';

const videoId = 'dQw4w9WgXcQ';

function makeSnapshot(overrides: Partial<MetadataSnapshot> = {}): MetadataSnapshot {
  return {
    schemaVersion: 1,
    tabId: 5,
    requestId: 1,
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    pageType: 'shorts',
    contentType: 'short',
    playbackStatus: 'unknown',
    extractedAt: '2026-10-05T18:00:00.000Z',
    title: { status: 'available', value: 'Source title', source: 'structured' },
    description: { status: 'available', value: 'Line one\nLine two', source: 'structured' },
    tags: { status: 'available', value: ['a', ' b ', ''], source: 'structured' },
    hashtags: { status: 'available', value: ['#One', '#Two'], source: 'derived' },
    channelName: { status: 'available', value: 'Channel', source: 'structured' },
    channelUrl: { status: 'available', value: 'https://www.youtube.com/@channel', source: 'structured' },
    thumbnailUrl: { status: 'available', value: 'https://i.ytimg.com/vi/x/hq.jpg', source: 'structured' },
    publishDate: { status: 'available', value: '2009-10-24', source: 'structured' },
    durationSeconds: { status: 'available', value: 213, source: 'structured' },
    views: { status: 'available', value: 0, source: 'structured' },
    ...overrides,
  };
}

describe('buildCopyEverything (PRD Section 11 contract)', () => {
  it('produces the exact ordering, headings, separators, and omitted unknowns', () => {
    const output = buildCopyEverything(makeSnapshot(), { title: 'Edited title' });
    expect(output).toBe(
      [
        'TITLE:',
        'Edited title',
        '',
        'DESCRIPTION:',
        'Line one\nLine two',
        '',
        'TAGS:',
        'a, b',
        '',
        'HASHTAGS:',
        '#One #Two',
        '',
        'VIDEO URL:',
        `https://www.youtube.com/watch?v=${videoId}`,
        '',
        'VIDEO ID:',
        videoId,
        '',
        'CHANNEL NAME:',
        'Channel',
        '',
        'CHANNEL URL:',
        'https://www.youtube.com/@channel',
        '',
        'THUMBNAIL URL:',
        'https://i.ytimg.com/vi/x/hq.jpg',
        '',
        'PUBLISH DATE:',
        '2009-10-24',
        '',
        'DURATION:',
        '3:33',
        '',
        'VIEWS:',
        '0',
        '',
        'CONTENT TYPE:',
        'Short',
        '',
        'EXTRACTED AT:',
        '2026-10-05T18:00:00.000Z',
      ].join('\n'),
    );
  });

  it('omits empty, unavailable, errored, and unknown fields but keeps the URL and ID', () => {
    const snapshot = makeSnapshot({
      description: { status: 'empty', value: '', source: 'structured' },
      tags: { status: 'unavailable', value: null, source: null },
      channelName: { status: 'error', value: null, source: 'structured', errorCode: 'X' },
      channelUrl: { status: 'unavailable', value: null, source: null },
      thumbnailUrl: { status: 'unavailable', value: null, source: null },
      publishDate: { status: 'unavailable', value: null, source: null },
      durationSeconds: { status: 'unavailable', value: null, source: null },
      views: { status: 'unavailable', value: null, source: null },
      contentType: 'unknown',
      playbackStatus: 'recorded',
    });
    const output = buildCopyEverything(snapshot, {});
    expect(output).toContain(`VIDEO URL:\nhttps://www.youtube.com/watch?v=${videoId}`);
    expect(output).toContain(`VIDEO ID:\n${videoId}`);
    expect(output).toContain('PLAYBACK STATUS:\nRecorded');
    expect(output).not.toContain('DESCRIPTION:');
    expect(output).not.toMatch(/(^|\n)TAGS:/);
    expect(output).not.toContain('CHANNEL NAME:');
    expect(output).not.toContain('CHANNEL URL:');
    expect(output).not.toContain('THUMBNAIL URL:');
    expect(output).not.toContain('PUBLISH DATE:');
    expect(output).not.toContain('DURATION:');
    expect(output).not.toContain('VIEWS:');
    expect(output).not.toContain('CONTENT TYPE:');
  });

  it('marks partial hashtags and normalizes edited lists without splitting commas', () => {
    const partial = makeSnapshot({
      hashtags: {
        status: 'available',
        value: ['#One', '#Two'],
        source: 'derived',
        isPartial: true,
      },
    });
    expect(buildCopyEverything(partial, {})).toContain('HASHTAGS (PARTIAL):\n#One #Two');

    const edited = buildCopyEverything(makeSnapshot(), {
      hashtags: ['#alpha,beta', ' #gamma ', ''],
    });
    expect(edited).toContain('HASHTAGS:\n#alpha,beta #gamma');
    expect(edited).not.toContain('HASHTAGS (PARTIAL)');
  });

  it('treats an intentionally empty description edit as omitted', () => {
    const output = buildCopyEverything(makeSnapshot(), { description: '' });
    expect(output).not.toContain('DESCRIPTION:');
  });

  it('omits a fully cleared draft field list without placeholders', () => {
    const output = buildCopyEverything(makeSnapshot(), { tags: [], hashtags: [] });
    expect(output).not.toMatch(/(^|\n)TAGS:/);
    expect(output).not.toMatch(/(^|\n)HASHTAGS:/);
  });
});

describe('individual values', () => {
  it('formats individual copy values without headings', () => {
    const projection = projectDraft(makeSnapshot(), { title: 'Edited title' });
    expect(individualCopyText(projection, 'title')).toBe('Edited title');
    expect(individualCopyText(projection, 'description')).toBe('Line one\nLine two');
    expect(individualCopyText(projection, 'tags')).toBe('a, b');
    expect(individualCopyText(projection, 'hashtags')).toBe('#One #Two');
  });

  it('returns null for empty or unavailable values so copy stays disabled', () => {
    const projection = projectDraft(
      makeSnapshot({
        title: { status: 'unavailable', value: null, source: null },
        description: { status: 'empty', value: '', source: 'structured' },
      }),
      { tags: [], hashtags: ['   '] },
    );
    expect(individualCopyText(projection, 'title')).toBeNull();
    expect(individualCopyText(projection, 'description')).toBeNull();
    expect(individualCopyText(projection, 'tags')).toBeNull();
    expect(individualCopyText(projection, 'hashtags')).toBeNull();
  });

  it('trims token edges while preserving order', () => {
    expect(formatTagsValue([' one ', '', 'two', '  three  '])).toBe('one, two, three');
    expect(formatHashtagsValue([' #a ', '', '#b'])).toBe('#a #b');
    expect(formatTagsValue(['', '   '])).toBeNull();
  });
});
