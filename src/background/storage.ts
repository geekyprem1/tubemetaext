import { hasOverrides } from '../domain/drafts';
import type { DraftOverrides, EditableFieldKey, MetadataSnapshot, StoredRecord } from '../domain/metadata';
import { EDITABLE_FIELD_KEYS, SNAPSHOT_SCHEMA_VERSION } from '../domain/metadata';
import {
  isEditableFieldKey,
  isMetadataSnapshot,
  isPositiveInteger,
  isRecord,
  isStringListWithinLimits,
  isStoredRecord,
  isTextWithinLimit,
} from '../domain/validation';
import { videoIdPatternMatches } from '../domain/youtube-url';
import type { ErrorCode } from '../shared/errors';
import { MAX_SESSION_TOKEN_LENGTH } from '../shared/limits';

const SESSION_EPOCH_KEY = 'epoch';
const REQUEST_KEY_PREFIX = 'request:';
const RECORD_KEY_PREFIX = 'record:';
const CURRENT_KEY_PREFIX = 'current:';
const LOCAL_PREFERENCES_KEY = 'preferences';

export const PREFERENCES_SCHEMA_VERSION = 1;

export interface Preferences {
  schemaVersion: typeof PREFERENCES_SCHEMA_VERSION;
  theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: PREFERENCES_SCHEMA_VERSION,
  theme: 'system',
};

export type RepositoryResult = { ok: true; record: StoredRecord } | { ok: false; code: ErrorCode };

export interface DraftPatchInput {
  tabId: number;
  videoId: string;
  field: EditableFieldKey;
  value: string | string[];
  baseRevision: number;
  epoch: number;
}

export interface DraftResetInput {
  tabId: number;
  videoId: string;
  fields?: EditableFieldKey[];
  epoch: number;
}

let mutationQueue: Promise<unknown> = Promise.resolve();

function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function sessionArea(): chrome.storage.StorageArea {
  return chrome.storage.session;
}

function recordKey(tabId: number, videoId: string): string {
  return `${RECORD_KEY_PREFIX}${tabId}:${videoId}`;
}

function isNonNegativeIntegerValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function staleRevision(): { ok: false; code: ErrorCode } {
  return { ok: false, code: 'STALE_REVISION' };
}

async function readEpochValue(): Promise<number> {
  const stored = await sessionArea().get(SESSION_EPOCH_KEY);
  const value = stored[SESSION_EPOCH_KEY];
  return isNonNegativeIntegerValue(value) ? value : 0;
}

export function readEpoch(): Promise<number> {
  return readEpochValue();
}

export async function readRecord(tabId: number, videoId: string): Promise<StoredRecord | null> {
  const key = recordKey(tabId, videoId);
  const stored = await sessionArea().get(key);
  const record = stored[key];
  return isStoredRecord(record) ? record : null;
}

function draftTimestamp(value: unknown): number {
  return isStoredRecord(value) ? Date.parse(value.draft.updatedAt) || 0 : 0;
}

async function evictOldestReplaceableRecord(protectedKeys: Set<string>): Promise<boolean> {
  const all = await sessionArea().get(null);
  const candidate = Object.keys(all)
    .filter((key) => key.startsWith(RECORD_KEY_PREFIX) && !protectedKeys.has(key))
    .filter((key) => {
      const record = all[key];
      return isStoredRecord(record) && !hasOverrides(record.draft.overrides);
    })
    .sort((left, right) => draftTimestamp(all[left]) - draftTimestamp(all[right]))[0];
  if (candidate === undefined) return false;
  await sessionArea().remove(candidate);
  return true;
}

async function persistWithRecovery(
  entries: Record<string, unknown>,
  protectedKeys: string[],
): Promise<boolean> {
  const protectedSet = new Set(protectedKeys);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await sessionArea().set(entries);
      return true;
    } catch {
      const evicted = await evictOldestReplaceableRecord(protectedSet);
      if (!evicted) return false;
    }
  }
  return false;
}

export interface CurrentRequestMarker {
  tabId: number;
  videoId: string;
  requestId: number;
  sessionToken: string;
  epoch: number;
}

function currentKey(tabId: number): string {
  return `${CURRENT_KEY_PREFIX}${tabId}`;
}

function isCurrentRequestMarker(value: unknown): value is CurrentRequestMarker {
  return (
    isRecord(value) &&
    isPositiveInteger(value.tabId) &&
    typeof value.videoId === 'string' &&
    videoIdPatternMatches(value.videoId) &&
    isNonNegativeIntegerValue(value.requestId) &&
    typeof value.sessionToken === 'string' &&
    value.sessionToken.length > 0 &&
    value.sessionToken.length <= MAX_SESSION_TOKEN_LENGTH &&
    isNonNegativeIntegerValue(value.epoch)
  );
}

export function setCurrentRequest(
  marker: CurrentRequestMarker,
): Promise<{ ok: true } | { ok: false; code: ErrorCode }> {
  return serializeMutation(async () => {
    if (!isCurrentRequestMarker(marker)) return { ok: false, code: 'INVALID_PAYLOAD' };
    const key = currentKey(marker.tabId);
    const persisted = await persistWithRecovery({ [key]: marker }, [key]);
    if (!persisted) return { ok: false, code: 'STORAGE_FAILED' };
    return { ok: true };
  });
}

export async function readCurrentRequest(tabId: number): Promise<CurrentRequestMarker | null> {
  const key = currentKey(tabId);
  const stored = await sessionArea().get(key);
  const value = stored[key];
  return isCurrentRequestMarker(value) ? value : null;
}

export function clearCurrentRequest(
  tabId: number,
): Promise<{ ok: true } | { ok: false; code: ErrorCode }> {
  return serializeMutation(async () => {
    try {
      await sessionArea().remove(currentKey(tabId));
    } catch {
      return { ok: false, code: 'STORAGE_FAILED' };
    }
    return { ok: true };
  });
}

export function commitSnapshot(
  snapshot: MetadataSnapshot,
  expectedEpoch: number,
): Promise<RepositoryResult> {
  return serializeMutation(async () => {
    if (!isMetadataSnapshot(snapshot)) return { ok: false, code: 'INVALID_PAYLOAD' };
    if ((await readEpochValue()) !== expectedEpoch) return staleRevision();

    const key = recordKey(snapshot.tabId, snapshot.videoId);
    const stored = await sessionArea().get(key);
    const existing = isStoredRecord(stored[key]) ? stored[key] : null;
    const draft = existing?.draft ?? {
      tabId: snapshot.tabId,
      videoId: snapshot.videoId,
      updatedAt: new Date().toISOString(),
      overrides: {},
    };
    const record: StoredRecord = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      snapshot,
      draft,
      revision: existing ? existing.revision + 1 : 1,
    };

    const persisted = await persistWithRecovery({ [key]: record }, [key]);
    if (!persisted) return { ok: false, code: 'STORAGE_FAILED' };
    return { ok: true, record };
  });
}

function isValidPatchValue(field: EditableFieldKey, value: unknown): boolean {
  return field === 'title' || field === 'description'
    ? isTextWithinLimit(value)
    : isStringListWithinLimits(value);
}

export function applyDraftPatch(input: DraftPatchInput): Promise<RepositoryResult> {
  return serializeMutation(async () => {
    if (!isEditableFieldKey(input.field) || !isValidPatchValue(input.field, input.value)) {
      return { ok: false, code: 'INVALID_PAYLOAD' };
    }
    if ((await readEpochValue()) !== input.epoch) return staleRevision();

    const key = recordKey(input.tabId, input.videoId);
    const stored = await sessionArea().get(key);
    const existing = isStoredRecord(stored[key]) ? stored[key] : null;
    if (!existing) return { ok: false, code: 'VIDEO_CHANGED' };
    if (existing.revision !== input.baseRevision) return staleRevision();

    const overrides: DraftOverrides = { ...existing.draft.overrides };
    if (input.field === 'title' || input.field === 'description') {
      overrides[input.field] = input.value as string;
    } else {
      overrides[input.field] = input.value as string[];
    }

    const record: StoredRecord = {
      ...existing,
      draft: { ...existing.draft, updatedAt: new Date().toISOString(), overrides },
      revision: existing.revision + 1,
    };

    const persisted = await persistWithRecovery({ [key]: record }, [key]);
    if (!persisted) return { ok: false, code: 'STORAGE_FAILED' };
    return { ok: true, record };
  });
}

export function resetDraftOverrides(input: DraftResetInput): Promise<RepositoryResult> {
  return serializeMutation(async () => {
    if (input.fields !== undefined && !input.fields.every(isEditableFieldKey)) {
      return { ok: false, code: 'INVALID_PAYLOAD' };
    }
    if ((await readEpochValue()) !== input.epoch) return staleRevision();

    const key = recordKey(input.tabId, input.videoId);
    const stored = await sessionArea().get(key);
    const existing = isStoredRecord(stored[key]) ? stored[key] : null;
    if (!existing) return { ok: false, code: 'VIDEO_CHANGED' };

    const overrides: DraftOverrides = { ...existing.draft.overrides };
    for (const field of input.fields ?? EDITABLE_FIELD_KEYS) {
      delete overrides[field];
    }

    const record: StoredRecord = {
      ...existing,
      draft: { ...existing.draft, updatedAt: new Date().toISOString(), overrides },
      revision: existing.revision + 1,
    };

    const persisted = await persistWithRecovery({ [key]: record }, [key]);
    if (!persisted) return { ok: false, code: 'STORAGE_FAILED' };
    return { ok: true, record };
  });
}

export function clearAllSessionData(): Promise<
  { ok: true; epoch: number } | { ok: false; code: ErrorCode }
> {
  return serializeMutation(async () => {
    const all = await sessionArea().get(null);
    const keysToRemove = Object.keys(all).filter(
      (key) =>
        key.startsWith(RECORD_KEY_PREFIX) ||
        key.startsWith(REQUEST_KEY_PREFIX) ||
        key.startsWith(CURRENT_KEY_PREFIX),
    );
    const previousEpoch = isNonNegativeIntegerValue(all[SESSION_EPOCH_KEY])
      ? all[SESSION_EPOCH_KEY]
      : 0;
    try {
      if (keysToRemove.length > 0) await sessionArea().remove(keysToRemove);
      await sessionArea().set({ [SESSION_EPOCH_KEY]: previousEpoch + 1 });
    } catch {
      return { ok: false, code: 'STORAGE_FAILED' };
    }
    return { ok: true, epoch: previousEpoch + 1 };
  });
}

export function allocateRequestId(
  tabId: number,
): Promise<{ ok: true; requestId: number } | { ok: false; code: ErrorCode }> {
  return serializeMutation(async () => {
    const key = `${REQUEST_KEY_PREFIX}${tabId}`;
    const stored = await sessionArea().get(key);
    const previous = stored[key];
    const requestId = isNonNegativeIntegerValue(previous) ? previous + 1 : 1;
    const persisted = await persistWithRecovery({ [key]: requestId }, [key]);
    if (!persisted) return { ok: false, code: 'STORAGE_FAILED' };
    return { ok: true, requestId };
  });
}

function isPreferences(value: unknown): value is Preferences {
  return (
    isRecord(value) &&
    value.schemaVersion === PREFERENCES_SCHEMA_VERSION &&
    (value.theme === 'light' || value.theme === 'dark' || value.theme === 'system')
  );
}

export async function readPreferences(): Promise<Preferences> {
  try {
    const stored = await chrome.storage.local.get(LOCAL_PREFERENCES_KEY);
    const value = stored[LOCAL_PREFERENCES_KEY];
    return isPreferences(value) ? value : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(
  preferences: Preferences,
): Promise<{ ok: true } | { ok: false; code: ErrorCode }> {
  return serializeMutation(async () => {
    if (!isPreferences(preferences)) return { ok: false, code: 'INVALID_PAYLOAD' };
    try {
      await chrome.storage.local.set({ [LOCAL_PREFERENCES_KEY]: preferences });
    } catch {
      return { ok: false, code: 'STORAGE_FAILED' };
    }
    return { ok: true };
  });
}
