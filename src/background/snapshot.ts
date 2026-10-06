import type { PlayerReaderOutcome } from '../content/readers/main-world';
import type { DomCandidates } from '../content/readers/video-dom';
import type { Field, FieldSource, MetadataSnapshot } from '../domain/metadata';
import { SNAPSHOT_SCHEMA_VERSION } from '../domain/metadata';
import { extractHashtags } from '../domain/hashtags';
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
} from '../domain/normalize';
import { isMetadataSnapshot } from '../domain/validation';
import type { VideoTarget } from '../domain/youtube-url';
import type { ErrorCode } from '../shared/errors';

export interface SnapshotSource {
  tabId: number;
  requestId: number;
  target: VideoTarget;
  reader: PlayerReaderOutcome;
  dom: DomCandidates | null;
  extractedAt: string;
}

export type SnapshotBuildResult =
  | { ok: true; snapshot: MetadataSnapshot }
  | { ok: false; code: ErrorCode };

function preferStructured<T>(
  primary: Field<T>,
  fallbackRaw: unknown,
  normalizeFallback: (raw: unknown, source: FieldSource) => Field<T>,
): Field<T> {
  if (primary.status === 'available' || primary.status === 'empty') return primary;
  const fromDom = normalizeFallback(fallbackRaw, 'dom');
  return fromDom.status === 'available' || fromDom.status === 'empty' ? fromDom : primary;
}

export function buildMetadataSnapshot(source: SnapshotSource): SnapshotBuildResult {
  const { tabId, requestId, target, reader, dom, extractedAt } = source;
  if (reader.ok !== true) return { ok: false, code: 'READER_FAILED' };
  if (reader.videoId !== target.videoId) return { ok: false, code: 'VIDEO_CHANGED' };

  const playbackStatus = normalizePlaybackStatus(reader.live);
  const contentType = normalizeContentType(target.pageType);

  const title = preferStructured(normalizeTitle(reader.title), dom?.title, normalizeTitle);
  const description = normalizeDescription(reader.description);
  const tags = normalizeTags(reader.keywords, reader.keywordsPresent);
  const hashtags = extractHashtags(title, description);
  const channelName = preferStructured(
    normalizeOptionalText(reader.channelName),
    dom?.channelName,
    normalizeOptionalText,
  );
  const channelUrl = preferStructured(
    normalizeYoutubeUrl(reader.channelUrl),
    dom?.channelUrl,
    normalizeYoutubeUrl,
  );
  const thumbnailUrl = preferStructured(
    normalizeThumbnailUrl(reader.thumbnailUrl),
    dom?.thumbnailUrl,
    normalizeThumbnailUrl,
  );
  const publishDate = preferStructured(
    normalizePublishDateField(reader.publishDate),
    dom?.publishDateMeta,
    normalizePublishDateField,
  );
  const durationSeconds = preferStructured(
    normalizeDurationField(reader.durationSeconds, playbackStatus),
    dom?.mediaDurationSeconds,
    (raw, source) => normalizeDurationField(raw, playbackStatus, source),
  );
  const views = preferStructured(
    normalizeViewsField(reader.views, playbackStatus),
    dom?.viewsText,
    (raw, source) => normalizeViewsField(raw, playbackStatus, source),
  );

  const coreFields = [title, description, tags, hashtags];
  if (coreFields.every((field) => field.status === 'unavailable' || field.status === 'error')) {
    return { ok: false, code: 'NO_CORE_METADATA' };
  }

  const snapshot: MetadataSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    tabId,
    requestId,
    videoId: target.videoId,
    videoUrl: target.canonicalUrl,
    pageType: target.pageType,
    contentType,
    playbackStatus,
    extractedAt,
    title,
    description,
    tags,
    hashtags,
    channelName,
    channelUrl,
    thumbnailUrl,
    publishDate,
    durationSeconds,
    views,
  };

  return isMetadataSnapshot(snapshot) ? { ok: true, snapshot } : { ok: false, code: 'READER_FAILED' };
}
