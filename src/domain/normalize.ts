import { MAX_ITEM_LENGTH, MAX_LIST_ITEMS, MAX_TEXT_LENGTH, MAX_URL_LENGTH } from '../shared/limits';
import type { ContentType, Field, FieldSource, PageType, PlaybackStatus } from './metadata';
import { available, emptyField, errorField, unavailable } from './metadata';
import { isSafeThumbnailHttpsUrl, isSafeYoutubeHttpsUrl } from './validation';

export interface LiveFlags {
  isUpcoming: boolean;
  isLiveNow: boolean;
  isLiveContent: boolean | undefined;
}

export function normalizeTitle(raw: unknown, source: FieldSource = 'structured'): Field<string> {
  if (typeof raw !== 'string' || raw === '') return unavailable();
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (text === '') return unavailable();
  if (text.length > MAX_TEXT_LENGTH) return errorField('FIELD_TOO_LARGE', source);
  return available(text, source);
}

export function normalizeDescription(raw: unknown, source: FieldSource = 'structured'): Field<string> {
  if (typeof raw !== 'string') return unavailable();
  const text = raw.replace(/\r\n?/g, '\n');
  if (text.length > MAX_TEXT_LENGTH) return errorField('FIELD_TOO_LARGE', source);
  if (text === '') return emptyField('', source);
  return available(text, source);
}

export function normalizeTags(rawKeywords: unknown, keywordsPresent: boolean): Field<string[]> {
  if (!keywordsPresent) return unavailable();
  if (!Array.isArray(rawKeywords) || rawKeywords.length > MAX_LIST_ITEMS) {
    return errorField('INVALID_OR_TOO_LARGE', 'structured');
  }
  const items: string[] = [];
  for (const item of rawKeywords) {
    if (typeof item !== 'string' || item.length > MAX_ITEM_LENGTH) {
      return errorField('INVALID_OR_TOO_LARGE', 'structured');
    }
    const clean = item.trim();
    if (clean) items.push(clean);
  }
  return items.length > 0 ? available(items, 'structured') : emptyField([], 'structured');
}

export function normalizeOptionalText(raw: unknown, source: FieldSource = 'structured'): Field<string> {
  if (typeof raw !== 'string') return unavailable();
  const text = raw.trim();
  if (text === '' || text.length > MAX_TEXT_LENGTH) return unavailable();
  return available(text, source);
}

export function upgradeToHttps(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeYoutubeUrl(rawUrl: unknown, source: FieldSource = 'structured'): Field<string> {
  const upgraded = upgradeToHttps(rawUrl);
  return upgraded !== null && isSafeYoutubeHttpsUrl(upgraded)
    ? available(upgraded, source)
    : unavailable();
}

export function normalizeThumbnailUrl(
  rawUrl: unknown,
  source: FieldSource = 'structured',
): Field<string> {
  const upgraded = upgradeToHttps(rawUrl);
  return upgraded !== null && isSafeThumbnailHttpsUrl(upgraded)
    ? available(upgraded, source)
    : unavailable();
}

export function parseExactCount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  }
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/\s*views?$/i, '').trim();
  let digits: string;
  if (/^\d+$/.test(cleaned)) {
    digits = cleaned;
  } else if (/^\d{1,3}(?:,\d{3})+$/.test(cleaned)) {
    digits = cleaned.replace(/,/g, '');
  } else {
    return null;
  }
  const value = Number(digits);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function normalizeViewsField(
  raw: unknown,
  playbackStatus: PlaybackStatus,
  source: FieldSource = 'structured',
): Field<number> {
  if (playbackStatus === 'live' || playbackStatus === 'upcoming') return unavailable();
  const parsed = parseExactCount(raw);
  return parsed === null ? unavailable() : available(parsed, source);
}

export function parseDurationSeconds(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  }
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeDurationField(
  raw: unknown,
  playbackStatus: PlaybackStatus,
  source: FieldSource = 'structured',
): Field<number> {
  if (playbackStatus === 'live' || playbackStatus === 'upcoming') return unavailable();
  const parsed = parseDurationSeconds(raw);
  return parsed === null || parsed === 0 ? unavailable() : available(parsed, source);
}

export function parseDateOnly(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  const datePart = match ? match[1] : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const date = new Date(`${datePart}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === datePart
    ? datePart
    : null;
}

export function normalizePublishDateField(
  raw: unknown,
  source: FieldSource = 'structured',
): Field<string> {
  const parsed = parseDateOnly(raw);
  return parsed === null ? unavailable() : available(parsed, source);
}

export function normalizePlaybackStatus(live: LiveFlags | null | undefined): PlaybackStatus {
  if (!live) return 'unknown';
  if (live.isUpcoming === true) return 'upcoming';
  if (live.isLiveNow === true) return 'live';
  if (live.isLiveContent === false) return 'recorded';
  return 'unknown';
}

export function normalizeContentType(pageType: PageType): ContentType {
  return pageType === 'shorts' ? 'short' : 'unknown';
}
