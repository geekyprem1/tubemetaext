import type { DraftProjection } from './drafts';
import { projectDraft } from './drafts';
import { formatDuration } from './format';
import type {
  ContentType,
  DraftOverrides,
  EditableFieldKey,
  Field,
  MetadataSnapshot,
  PlaybackStatus,
} from './metadata';
import { isAvailable } from './metadata';

const CONTENT_TYPE_EXPORT: Partial<Record<ContentType, string>> = {
  long: 'Long video',
  short: 'Short',
};

const PLAYBACK_EXPORT: Partial<Record<PlaybackStatus, string>> = {
  recorded: 'Recorded',
  live: 'Live',
  upcoming: 'Upcoming',
  premiere: 'Premiere',
};

function trimmedTokens(tokens: string[]): string[] {
  return tokens.map((token) => token.trim()).filter((token) => token.length > 0);
}

export function formatTagsValue(tokens: string[]): string | null {
  const joined = trimmedTokens(tokens).join(', ');
  return joined.length > 0 ? joined : null;
}

export function formatHashtagsValue(tokens: string[]): string | null {
  const joined = trimmedTokens(tokens).join(' ');
  return joined.length > 0 ? joined : null;
}

function textOrNull(value: string | null): string | null {
  return value !== null && value.length > 0 ? value : null;
}

function snapshotText(field: Field<string>): string | null {
  return isAvailable(field) && field.value.length > 0 ? field.value : null;
}

export function individualCopyText(
  projection: DraftProjection,
  field: EditableFieldKey,
): string | null {
  switch (field) {
    case 'title':
      return textOrNull(projection.title.value);
    case 'description':
      return textOrNull(projection.description.value);
    case 'tags':
      return projection.tags.value === null ? null : formatTagsValue(projection.tags.value);
    case 'hashtags':
      return projection.hashtags.value === null ? null : formatHashtagsValue(projection.hashtags.value);
  }
}

export function buildCopyEverything(snapshot: MetadataSnapshot, overrides: DraftOverrides): string {
  const projection = projectDraft(snapshot, overrides);
  const rows: Array<[string, string | null]> = [
    ['TITLE', textOrNull(projection.title.value)],
    ['DESCRIPTION', textOrNull(projection.description.value)],
    ['TAGS', projection.tags.value === null ? null : formatTagsValue(projection.tags.value)],
    [
      projection.hashtags.isPartial ? 'HASHTAGS (PARTIAL)' : 'HASHTAGS',
      projection.hashtags.value === null ? null : formatHashtagsValue(projection.hashtags.value),
    ],
    ['VIDEO URL', snapshot.videoUrl],
    ['VIDEO ID', snapshot.videoId],
    ['CHANNEL NAME', snapshotText(snapshot.channelName)],
    ['CHANNEL URL', snapshotText(snapshot.channelUrl)],
    ['THUMBNAIL URL', snapshotText(snapshot.thumbnailUrl)],
    ['PUBLISH DATE', snapshotText(snapshot.publishDate)],
    [
      'DURATION',
      isAvailable(snapshot.durationSeconds) ? formatDuration(snapshot.durationSeconds.value) : null,
    ],
    ['VIEWS', isAvailable(snapshot.views) ? String(snapshot.views.value) : null],
    ['CONTENT TYPE', CONTENT_TYPE_EXPORT[snapshot.contentType] ?? null],
    ['PLAYBACK STATUS', PLAYBACK_EXPORT[snapshot.playbackStatus] ?? null],
    ['EXTRACTED AT', snapshot.extractedAt],
  ];
  return rows
    .filter((row): row is [string, string] => row[1] !== null && row[1].length > 0)
    .map(([heading, value]) => `${heading}:\n${value}`)
    .join('\n\n');
}
