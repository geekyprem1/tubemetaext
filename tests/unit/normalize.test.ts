import { describe, expect, it } from 'vitest';
import {
  normalizeContentType,
  normalizeDescription,
  normalizeDurationField,
  normalizeOptionalText,
  normalizePlaybackStatus,
  normalizePublishDateField,
  normalizeTags,
  normalizeThumbnailUrl,
  normalizeTitle,
  normalizeViewsField,
  normalizeYoutubeUrl,
  parseDateOnly,
  parseDurationSeconds,
  parseExactCount,
  upgradeToHttps,
} from '../../src/domain/normalize';

describe('normalizeTitle / normalizeDescription', () => {
  it('keeps title and description statuses distinct and normalizes newlines', () => {
    expect(normalizeTitle(null)).toEqual({ status: 'unavailable', value: null, source: null });
    expect(normalizeTitle('')).toEqual({ status: 'unavailable', value: null, source: null });
    expect(normalizeTitle('  Example  ')).toEqual({
      status: 'available',
      value: 'Example',
      source: 'structured',
    });

    expect(normalizeDescription('')).toEqual({
      status: 'empty',
      value: '',
      source: 'structured',
    });
    expect(normalizeDescription(null).status).toBe('unavailable');
    expect(normalizeDescription('Line one\r\nLine two\rThree')).toEqual({
      status: 'available',
      value: 'Line one\nLine two\nThree',
      source: 'structured',
    });
  });

  it('reports oversized text as a controlled field error without truncating', () => {
    const oversized = 'a'.repeat(100_001);
    expect(normalizeDescription(oversized)).toEqual({
      status: 'error',
      value: null,
      source: 'structured',
      errorCode: 'FIELD_TOO_LARGE',
    });
    expect(normalizeTitle(oversized).status).toBe('error');
  });

  it('normalizes optional text without inventing values', () => {
    expect(normalizeOptionalText('  Channel name  ')).toEqual({
      status: 'available',
      value: 'Channel name',
      source: 'structured',
    });
    expect(normalizeOptionalText('')).toEqual({ status: 'unavailable', value: null, source: null });
    expect(normalizeOptionalText(42).status).toBe('unavailable');
  });
});

describe('normalizeTags', () => {
  it('keeps absent tags unavailable, empty lists empty, and trims valid entries', () => {
    expect(normalizeTags(['a'], false)).toEqual({ status: 'unavailable', value: null, source: null });
    expect(normalizeTags([], true)).toEqual({ status: 'empty', value: [], source: 'structured' });
    expect(normalizeTags([' a ', '', 'b'], true)).toEqual({
      status: 'available',
      value: ['a', 'b'],
      source: 'structured',
    });
  });

  it('rejects malformed entries and oversized lists as controlled errors', () => {
    expect(normalizeTags(['ok', 7], true)).toEqual({
      status: 'error',
      value: null,
      source: 'structured',
      errorCode: 'INVALID_OR_TOO_LARGE',
    });
    expect(normalizeTags(new Array(1001).fill('x'), true).status).toBe('error');
    expect(normalizeTags(['x'.repeat(2001)], true).status).toBe('error');
  });
});

describe('exact counts, views, and durations', () => {
  it('accepts exact integers with optional comma grouping and English views suffix', () => {
    expect(parseExactCount('123')).toBe(123);
    expect(parseExactCount('0')).toBe(0);
    expect(parseExactCount(0)).toBe(0);
    expect(parseExactCount('1,234,567')).toBe(1234567);
    expect(parseExactCount('1,823,562,145 views')).toBe(1823562145);
  });

  it('never fabricates exact counts from abbreviated or localized values', () => {
    expect(parseExactCount('1.2M')).toBeNull();
    expect(parseExactCount('12.5')).toBeNull();
    expect(parseExactCount('१२३')).toBeNull();
    expect(parseExactCount('1,234 views extra')).toBeNull();
    expect(parseExactCount('No views')).toBeNull();
    expect(parseExactCount(-1)).toBeNull();
    expect(parseExactCount(1.5)).toBeNull();
  });

  it('keeps zero views available and hides counts for live or upcoming content', () => {
    expect(normalizeViewsField(0, 'recorded')).toEqual({
      status: 'available',
      value: 0,
      source: 'structured',
    });
    expect(normalizeViewsField('123', 'recorded').status).toBe('available');
    expect(normalizeViewsField(123, 'live').status).toBe('unavailable');
    expect(normalizeViewsField(123, 'upcoming').status).toBe('unavailable');
    expect(normalizeViewsField('1.2M', 'recorded').status).toBe('unavailable');
  });

  it('rounds media durations, rejects zero and live elapsed durations', () => {
    expect(parseDurationSeconds(213.061)).toBe(213);
    expect(parseDurationSeconds('44')).toBe(44);
    expect(parseDurationSeconds('abc')).toBeNull();
    expect(normalizeDurationField(213.061, 'recorded')).toEqual({
      status: 'available',
      value: 213,
      source: 'structured',
    });
    expect(normalizeDurationField(30, 'live').status).toBe('unavailable');
    expect(normalizeDurationField(0.4, 'recorded').status).toBe('unavailable');
  });
});

describe('dates and playback status', () => {
  it('reduces ISO timestamps to date-only and rejects relative or invalid dates', () => {
    expect(parseDateOnly('2009-10-24T23:57:33-07:00')).toBe('2009-10-24');
    expect(parseDateOnly('2009-10-24')).toBe('2009-10-24');
    expect(parseDateOnly('3 years ago')).toBeNull();
    expect(parseDateOnly('2025-02-31')).toBeNull();
    expect(normalizePublishDateField('3 years ago').status).toBe('unavailable');
    expect(normalizePublishDateField('2009-10-24T23:57:33-07:00')).toEqual({
      status: 'available',
      value: '2009-10-24',
      source: 'structured',
    });
  });

  it('derives playback and content types without inventing values', () => {
    expect(normalizePlaybackStatus({ isUpcoming: true, isLiveNow: false, isLiveContent: true })).toBe('upcoming');
    expect(normalizePlaybackStatus({ isUpcoming: false, isLiveNow: true, isLiveContent: true })).toBe('live');
    expect(normalizePlaybackStatus({ isUpcoming: false, isLiveNow: false, isLiveContent: false })).toBe('recorded');
    expect(normalizePlaybackStatus({ isUpcoming: false, isLiveNow: false, isLiveContent: undefined })).toBe('unknown');
    expect(normalizePlaybackStatus(null)).toBe('unknown');
    expect(normalizeContentType('shorts')).toBe('short');
    expect(normalizeContentType('watch')).toBe('unknown');
  });
});

describe('URL normalization', () => {
  it('upgrades http to https and rejects non-https or unparseable values', () => {
    expect(upgradeToHttps('http://www.youtube.com/@x')).toBe('https://www.youtube.com/@x');
    expect(upgradeToHttps('ftp://example.test/x')).toBeNull();
    expect(upgradeToHttps('not a url')).toBeNull();
  });

  it('gates channel and thumbnail URLs through the host allowlists', () => {
    expect(normalizeYoutubeUrl('http://www.youtube.com/@channel')).toEqual({
      status: 'available',
      value: 'https://www.youtube.com/@channel',
      source: 'structured',
    });
    expect(normalizeYoutubeUrl('https://evil.test/@channel').status).toBe('unavailable');
    expect(normalizeThumbnailUrl('https://i9.ytimg.com/vi/x/hq.jpg')).toEqual({
      status: 'available',
      value: 'https://i9.ytimg.com/vi/x/hq.jpg',
      source: 'structured',
    });
    expect(normalizeThumbnailUrl('https://evil.test/x.jpg').status).toBe('unavailable');
  });
});
