import { describe, expect, it } from 'vitest';
import { extractHashtags, hashtagDedupeKey } from '../../src/domain/hashtags';
import type { Field } from '../../src/domain/metadata';
import { available, emptyField, unavailable } from '../../src/domain/metadata';

function text(value: string): Field<string> {
  return available(value, 'structured');
}

describe('extractHashtags', () => {
  it('parses Unicode hashtags including Hindi and combining marks, preserving order', () => {
    const result = extractHashtags(
      text('Build with #AI और #हिंदी में #नमस्ते'),
      text('More on #बनाया with #हिंदी'),
    );
    expect(result).toEqual({
      status: 'available',
      value: ['#AI', '#हिंदी', '#नमस्ते', '#बनाया'],
      source: 'derived',
    });
  });

  it('deduplicates by NFKC-normalized lowercase key while keeping first-seen spelling', () => {
    const result = extractHashtags(text('#AI #ai #ＡＩ'), emptyField('', 'structured'));
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(result.value).toEqual(['#AI']);
    expect(hashtagDedupeKey('#ＡＩ')).toBe(hashtagDedupeKey('#ai'));
  });

  it('excludes URL fragments and standalone hashes', () => {
    const result = extractHashtags(
      text('Read https://example.test/path#fragment now'),
      text('Also https://example.test/#anchor and a bare # sign, but #Real stays'),
    );
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(result.value).toEqual(['#Real']);
  });

  it('marks results partial when an input is unavailable, and zero matches then reads unavailable', () => {
    const partial = extractHashtags(text('Clip with #One and #Two'), unavailable<string>());
    expect(partial).toEqual({
      status: 'available',
      value: ['#One', '#Two'],
      source: 'derived',
      isPartial: true,
    });

    const partialNoMatches = extractHashtags(text('No tags here'), unavailable<string>());
    expect(partialNoMatches).toEqual({ status: 'unavailable', value: null, source: null });
  });

  it('reports a confirmed empty list only when both inputs are complete', () => {
    expect(extractHashtags(text('No tags here'), emptyField('', 'structured'))).toEqual({
      status: 'empty',
      value: [],
      source: 'derived',
    });
    expect(extractHashtags(unavailable<string>(), unavailable<string>())).toEqual({
      status: 'unavailable',
      value: null,
      source: null,
    });
  });

  it('requires whitespace or string start before a hashtag', () => {
    const result = extractHashtags(text('sentence#glued'), emptyField('', 'structured'));
    expect(result.status).toBe('empty');
  });
});
