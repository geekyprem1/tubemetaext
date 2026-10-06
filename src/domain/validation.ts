import { MAX_ITEM_LENGTH, MAX_LIST_ITEMS, MAX_TEXT_LENGTH, MAX_URL_LENGTH } from '../shared/limits';
import type {
  ContentType,
  DraftOverrides,
  EditableFieldKey,
  Field,
  FieldSource,
  MetadataSnapshot,
  PageType,
  PlaybackStatus,
  SessionDraft,
  StoredRecord,
} from './metadata';
import {
  CONTENT_TYPES,
  EDITABLE_FIELD_KEYS,
  PAGE_TYPES,
  PLAYBACK_STATUSES,
  SNAPSHOT_SCHEMA_VERSION,
} from './metadata';
import { isYoutubeHostname, parseSupportedUrl, videoIdPatternMatches } from './youtube-url';

const FIELD_SOURCES: readonly FieldSource[] = ['structured', 'dom', 'derived'];

export type ValuePredicate<T> = (value: unknown) => value is T;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFieldSource(value: unknown): value is FieldSource {
  return typeof value === 'string' && (FIELD_SOURCES as readonly string[]).includes(value);
}

export function isPageType(value: unknown): value is PageType {
  return typeof value === 'string' && (PAGE_TYPES as readonly string[]).includes(value);
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && (CONTENT_TYPES as readonly string[]).includes(value);
}

export function isPlaybackStatus(value: unknown): value is PlaybackStatus {
  return typeof value === 'string' && (PLAYBACK_STATUSES as readonly string[]).includes(value);
}

export function isEditableFieldKey(value: unknown): value is EditableFieldKey {
  return typeof value === 'string' && (EDITABLE_FIELD_KEYS as readonly string[]).includes(value);
}

export function isField<T>(value: unknown, isValue: ValuePredicate<T>): value is Field<T> {
  if (!isRecord(value)) return false;
  switch (value.status) {
    case 'available':
      return (
        isValue(value.value) &&
        isFieldSource(value.source) &&
        (value.isPartial === undefined || typeof value.isPartial === 'boolean')
      );
    case 'empty':
      return isValue(value.value) && isFieldSource(value.source);
    case 'unavailable':
      return value.value === null && value.source === null;
    case 'error':
      return (
        value.value === null &&
        (value.source === null || isFieldSource(value.source)) &&
        typeof value.errorCode === 'string' &&
        value.errorCode.length > 0
      );
    default:
      return false;
  }
}

export function isTextWithinLimit(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH;
}

export function isStringListWithinLimits(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) return false;
  return value.every((item) => typeof item === 'string' && item.length <= MAX_ITEM_LENGTH);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

export function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isIsoDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isUtcIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export function isSafeYoutubeHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && isYoutubeHostname(url.hostname);
  } catch {
    return false;
  }
}

export function isSafeThumbnailHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return url.hostname === 'ytimg.com' || url.hostname.endsWith('.ytimg.com');
  } catch {
    return false;
  }
}

const SNAPSHOT_KEYS = new Set([
  'schemaVersion',
  'tabId',
  'requestId',
  'videoId',
  'videoUrl',
  'pageType',
  'contentType',
  'playbackStatus',
  'extractedAt',
  'title',
  'description',
  'tags',
  'hashtags',
  'channelName',
  'channelUrl',
  'thumbnailUrl',
  'publishDate',
  'durationSeconds',
  'views',
]);

export function isMetadataSnapshot(value: unknown): value is MetadataSnapshot {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !SNAPSHOT_KEYS.has(key))) return false;
  if (value.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return false;
  if (!isPositiveInteger(value.tabId) || !isNonNegativeInteger(value.requestId)) return false;
  if (typeof value.videoId !== 'string' || !videoIdPatternMatches(value.videoId)) return false;

  const parsedUrl = typeof value.videoUrl === 'string' ? parseSupportedUrl(value.videoUrl) : null;
  if (!parsedUrl || parsedUrl.videoId !== value.videoId) return false;
  if (!isPageType(value.pageType) || parsedUrl.pageType !== value.pageType) return false;
  if (!isContentType(value.contentType) || !isPlaybackStatus(value.playbackStatus)) return false;
  if (!isUtcIsoTimestamp(value.extractedAt)) return false;

  return (
    isField(value.title, isTextWithinLimit) &&
    isField(value.description, isTextWithinLimit) &&
    isField(value.tags, isStringListWithinLimits) &&
    isField(value.hashtags, isStringListWithinLimits) &&
    isField(value.channelName, isTextWithinLimit) &&
    isField(value.channelUrl, isSafeYoutubeHttpsUrl) &&
    isField(value.thumbnailUrl, isSafeThumbnailHttpsUrl) &&
    isField(value.publishDate, isIsoDateOnly) &&
    isField(value.durationSeconds, isFiniteNonNegativeNumber) &&
    isField(value.views, isNonNegativeInteger)
  );
}

export function isDraftOverrides(value: unknown): value is DraftOverrides {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !isEditableFieldKey(key))) return false;
  if ('title' in value && !isTextWithinLimit(value.title)) return false;
  if ('description' in value && !isTextWithinLimit(value.description)) return false;
  if ('tags' in value && !isStringListWithinLimits(value.tags)) return false;
  if ('hashtags' in value && !isStringListWithinLimits(value.hashtags)) return false;
  return true;
}

export function isSessionDraft(value: unknown): value is SessionDraft {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !['tabId', 'videoId', 'updatedAt', 'overrides'].includes(key))) {
    return false;
  }
  if (!isPositiveInteger(value.tabId)) return false;
  if (typeof value.videoId !== 'string' || !videoIdPatternMatches(value.videoId)) return false;
  if (!isUtcIsoTimestamp(value.updatedAt)) return false;
  return isDraftOverrides(value.overrides);
}

export function isStoredRecord(value: unknown): value is StoredRecord {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !['schemaVersion', 'snapshot', 'draft', 'revision'].includes(key))) {
    return false;
  }
  if (value.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return false;
  if (!isMetadataSnapshot(value.snapshot) || !isSessionDraft(value.draft)) return false;
  if (!isNonNegativeInteger(value.revision)) return false;
  return value.snapshot.tabId === value.draft.tabId && value.snapshot.videoId === value.draft.videoId;
}
