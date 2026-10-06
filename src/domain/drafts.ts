import type { DraftOverrides, Field, FieldStatus, MetadataSnapshot } from './metadata';
import { EDITABLE_FIELD_KEYS } from './metadata';

export interface ProjectedField<T> {
  value: T | null;
  edited: boolean;
  sourceStatus: FieldStatus;
  isPartial: boolean;
}

export interface DraftProjection {
  title: ProjectedField<string>;
  description: ProjectedField<string>;
  tags: ProjectedField<string[]>;
  hashtags: ProjectedField<string[]>;
}

export function hasOverrides(overrides: DraftOverrides): boolean {
  return EDITABLE_FIELD_KEYS.some((key) => overrides[key] !== undefined);
}

function sourceValue<T>(field: Field<T>): T | null {
  return field.status === 'available' || field.status === 'empty' ? field.value : null;
}

function projectField<T>(field: Field<T>, override: T | undefined): ProjectedField<T> {
  if (override !== undefined) {
    return { value: override, edited: true, sourceStatus: field.status, isPartial: false };
  }
  return {
    value: sourceValue(field),
    edited: false,
    sourceStatus: field.status,
    isPartial: field.status === 'available' && field.isPartial === true,
  };
}

export function projectDraft(snapshot: MetadataSnapshot, overrides: DraftOverrides): DraftProjection {
  return {
    title: projectField(snapshot.title, overrides.title),
    description: projectField(snapshot.description, overrides.description),
    tags: projectField(snapshot.tags, overrides.tags),
    hashtags: projectField(snapshot.hashtags, overrides.hashtags),
  };
}
