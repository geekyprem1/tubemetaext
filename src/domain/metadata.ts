export const SNAPSHOT_SCHEMA_VERSION = 1;

export const PAGE_TYPES = ['watch', 'shorts'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const CONTENT_TYPES = ['long', 'short', 'unknown'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const PLAYBACK_STATUSES = ['recorded', 'live', 'upcoming', 'premiere', 'unknown'] as const;
export type PlaybackStatus = (typeof PLAYBACK_STATUSES)[number];

export const EDITABLE_FIELD_KEYS = ['title', 'description', 'tags', 'hashtags'] as const;
export type EditableFieldKey = (typeof EDITABLE_FIELD_KEYS)[number];

export type FieldSource = 'structured' | 'dom' | 'derived';

export type FieldStatus = 'available' | 'empty' | 'unavailable' | 'error';

export interface AvailableField<T> {
  status: 'available';
  value: T;
  source: FieldSource;
  isPartial?: boolean;
}

export interface EmptyField<T> {
  status: 'empty';
  value: T;
  source: FieldSource;
}

export interface UnavailableField {
  status: 'unavailable';
  value: null;
  source: null;
}

export interface ErrorField {
  status: 'error';
  value: null;
  source: FieldSource | null;
  errorCode: string;
}

export type Field<T> = AvailableField<T> | EmptyField<T> | UnavailableField | ErrorField;

export function available<T>(value: T, source: FieldSource, isPartial = false): AvailableField<T> {
  return isPartial
    ? { status: 'available', value, source, isPartial: true }
    : { status: 'available', value, source };
}

export function emptyField<T>(value: T, source: FieldSource): EmptyField<T> {
  return { status: 'empty', value, source };
}

export function unavailable<T>(): Field<T> {
  return { status: 'unavailable', value: null, source: null };
}

export function errorField<T>(errorCode: string, source: FieldSource | null): Field<T> {
  return { status: 'error', value: null, source, errorCode };
}

export function isAvailable<T>(field: Field<T>): field is AvailableField<T> {
  return field.status === 'available';
}

export interface MetadataSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  tabId: number;
  requestId: number;
  videoId: string;
  videoUrl: string;
  pageType: PageType;
  contentType: ContentType;
  playbackStatus: PlaybackStatus;
  extractedAt: string;
  title: Field<string>;
  description: Field<string>;
  tags: Field<string[]>;
  hashtags: Field<string[]>;
  channelName: Field<string>;
  channelUrl: Field<string>;
  thumbnailUrl: Field<string>;
  publishDate: Field<string>;
  durationSeconds: Field<number>;
  views: Field<number>;
}

export interface DraftOverrides {
  title?: string;
  description?: string;
  tags?: string[];
  hashtags?: string[];
}

export interface SessionDraft {
  tabId: number;
  videoId: string;
  updatedAt: string;
  overrides: DraftOverrides;
}

export interface StoredRecord {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  snapshot: MetadataSnapshot;
  draft: SessionDraft;
  revision: number;
}
