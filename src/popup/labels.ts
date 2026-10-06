import type { ContentType, PlaybackStatus } from '../domain/metadata';

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  long: 'Long video',
  short: 'Short',
  unknown: 'Video',
};

export const PLAYBACK_LABELS: Record<PlaybackStatus, string> = {
  recorded: 'Recorded',
  live: 'Live',
  upcoming: 'Upcoming',
  premiere: 'Premiere',
  unknown: 'Unknown',
};
