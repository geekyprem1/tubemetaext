import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetadataSnapshot } from '../../src/domain/metadata';
import { FakeStorageArea } from '../helpers/fake-storage';

const sessionArea = new FakeStorageArea();
const localArea = new FakeStorageArea();
vi.stubGlobal('chrome', { storage: { session: sessionArea, local: localArea } });

const {
  DEFAULT_PREFERENCES,
  allocateRequestId,
  applyDraftPatch,
  clearAllSessionData,
  clearCurrentRequest,
  commitSnapshot,
  readCurrentRequest,
  readEpoch,
  readPreferences,
  readRecord,
  resetDraftOverrides,
  savePreferences,
  setCurrentRequest,
} = await import('../../src/background/storage');

const videoId = 'dQw4w9WgXcQ';

function makeSnapshot(tabId: number, id: string, description = 'Source description'): MetadataSnapshot {
  return {
    schemaVersion: 1,
    tabId,
    requestId: 1,
    videoId: id,
    videoUrl: `https://www.youtube.com/watch?v=${id}`,
    pageType: 'watch',
    contentType: 'unknown',
    playbackStatus: 'unknown',
    extractedAt: '2026-10-05T18:00:00.000Z',
    title: { status: 'available', value: 'Source title', source: 'structured' },
    description: { status: 'available', value: description, source: 'structured' },
    tags: { status: 'unavailable', value: null, source: null },
    hashtags: { status: 'available', value: ['#AI'], source: 'derived' },
    channelName: { status: 'available', value: 'Channel', source: 'structured' },
    channelUrl: { status: 'available', value: 'https://www.youtube.com/@x', source: 'structured' },
    thumbnailUrl: { status: 'available', value: 'https://i.ytimg.com/vi/x/hq.jpg', source: 'structured' },
    publishDate: { status: 'available', value: '2025-01-02', source: 'structured' },
    durationSeconds: { status: 'available', value: 60, source: 'structured' },
    views: { status: 'available', value: 0, source: 'structured' },
  };
}

beforeEach(() => {
  sessionArea.entries = new Map();
  sessionArea.maxBytes = Number.POSITIVE_INFINITY;
  localArea.entries = new Map();
  localArea.maxBytes = Number.POSITIVE_INFINITY;
});

describe('session repository', () => {
  it('commits snapshots with an empty draft and hydrates them back', async () => {
    const result = await commitSnapshot(makeSnapshot(11, videoId), 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.revision).toBe(1);
    expect(result.record.draft.overrides).toEqual({});

    expect(await readRecord(11, videoId)).toEqual(result.record);
    expect(await readRecord(11, 'abcdefghijk')).toBeNull();
  });

  it('keeps tab and video records independent', async () => {
    await commitSnapshot(makeSnapshot(11, videoId), 0);
    await commitSnapshot(makeSnapshot(12, 'abcdefghijk'), 0);

    const patched = await applyDraftPatch({
      tabId: 11,
      videoId,
      field: 'title',
      value: 'Only tab 11',
      baseRevision: 1,
      epoch: 0,
    });
    expect(patched.ok).toBe(true);

    expect((await readRecord(11, videoId))?.draft.overrides.title).toBe('Only tab 11');
    expect((await readRecord(12, 'abcdefghijk'))?.draft.overrides).toEqual({});
  });

  it('keeps draft overrides when the snapshot refreshes', async () => {
    await commitSnapshot(makeSnapshot(11, videoId), 0);
    const patched = await applyDraftPatch({
      tabId: 11,
      videoId,
      field: 'title',
      value: 'Edited title',
      baseRevision: 1,
      epoch: 0,
    });
    expect(patched.ok).toBe(true);

    const refreshed = await commitSnapshot(
      makeSnapshot(11, videoId, 'Refreshed description'),
      0,
    );
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.record.revision).toBe(3);
    expect(refreshed.record.draft.overrides.title).toBe('Edited title');
    expect(refreshed.record.snapshot.description).toEqual({
      status: 'available',
      value: 'Refreshed description',
      source: 'structured',
    });
  });

  it('distinguishes missing overrides from intentionally empty overrides', async () => {
    await commitSnapshot(makeSnapshot(11, videoId), 0);
    await applyDraftPatch({ tabId: 11, videoId, field: 'title', value: '', baseRevision: 1, epoch: 0 });
    await applyDraftPatch({ tabId: 11, videoId, field: 'tags', value: [], baseRevision: 2, epoch: 0 });

    const withEmpty = await readRecord(11, videoId);
    expect(withEmpty?.draft.overrides.title).toBe('');
    expect('title' in (withEmpty?.draft.overrides ?? {})).toBe(true);
    expect(withEmpty?.draft.overrides.tags).toEqual([]);

    const resetTitle = await resetDraftOverrides({ tabId: 11, videoId, fields: ['title'], epoch: 0 });
    expect(resetTitle.ok).toBe(true);
    const afterSingleReset = await readRecord(11, videoId);
    expect('title' in (afterSingleReset?.draft.overrides ?? {})).toBe(false);
    expect(afterSingleReset?.draft.overrides.tags).toEqual([]);

    const resetAll = await resetDraftOverrides({ tabId: 11, videoId, epoch: 0 });
    expect(resetAll.ok).toBe(true);
    expect((await readRecord(11, videoId))?.draft.overrides).toEqual({});
  });

  it('rejects stale revisions, stale epochs, and missing records', async () => {
    await commitSnapshot(makeSnapshot(11, videoId), 0);

    expect(
      await applyDraftPatch({ tabId: 11, videoId, field: 'title', value: 'x', baseRevision: 99, epoch: 0 }),
    ).toEqual({ ok: false, code: 'STALE_REVISION' });
    expect(
      await applyDraftPatch({ tabId: 11, videoId, field: 'title', value: 'x', baseRevision: 1, epoch: 9 }),
    ).toEqual({ ok: false, code: 'STALE_REVISION' });
    expect(
      await applyDraftPatch({
        tabId: 77,
        videoId: 'abcdefghijk',
        field: 'title',
        value: 'x',
        baseRevision: 1,
        epoch: 0,
      }),
    ).toEqual({ ok: false, code: 'VIDEO_CHANGED' });
    expect(await commitSnapshot(makeSnapshot(11, videoId), 9)).toEqual({
      ok: false,
      code: 'STALE_REVISION',
    });
  });

  it('validates payloads before persisting', async () => {
    const invalid = makeSnapshot(11, videoId);
    const broken = {
      ...invalid,
      views: { status: 'available', value: -1, source: 'structured' },
    } as unknown as MetadataSnapshot;
    expect(await commitSnapshot(broken, 0)).toEqual({ ok: false, code: 'INVALID_PAYLOAD' });

    await commitSnapshot(makeSnapshot(11, videoId), 0);
    expect(
      await applyDraftPatch({
        tabId: 11,
        videoId,
        field: 'tags',
        value: 'not-a-list' as unknown as string[],
        baseRevision: 1,
        epoch: 0,
      }),
    ).toEqual({ ok: false, code: 'INVALID_PAYLOAD' });
  });

  it('allocates per-tab request ids and resets them when session data clears', async () => {
    expect(await allocateRequestId(11)).toEqual({ ok: true, requestId: 1 });
    expect(await allocateRequestId(11)).toEqual({ ok: true, requestId: 2 });
    expect(await allocateRequestId(12)).toEqual({ ok: true, requestId: 1 });

    await commitSnapshot(makeSnapshot(11, videoId), 0);
    const cleared = await clearAllSessionData();
    expect(cleared).toEqual({ ok: true, epoch: 1 });
    expect(await readEpoch()).toBe(1);

    expect(await readRecord(11, videoId)).toBeNull();
    expect(
      await applyDraftPatch({ tabId: 11, videoId, field: 'title', value: 'x', baseRevision: 1, epoch: 0 }),
    ).toEqual({ ok: false, code: 'STALE_REVISION' });
    expect(await allocateRequestId(11)).toEqual({ ok: true, requestId: 1 });
  });

  it('evicts unedited snapshots to make room under quota pressure', async () => {
    await commitSnapshot(makeSnapshot(21, 'aaaaaaaaaaa', 'a'.repeat(900)), 0);
    await commitSnapshot(makeSnapshot(22, 'bbbbbbbbbbb', 'b'.repeat(50)), 0);
    await applyDraftPatch({
      tabId: 22,
      videoId: 'bbbbbbbbbbb',
      field: 'title',
      value: 'Edited',
      baseRevision: 1,
      epoch: 0,
    });

    sessionArea.maxBytes = sessionArea.totalBytes() + 100;

    const result = await commitSnapshot(makeSnapshot(23, 'ccccccccccc', 'c'.repeat(500)), 0);
    expect(result.ok).toBe(true);
    expect(await readRecord(21, 'aaaaaaaaaaa')).toBeNull();
    expect((await readRecord(22, 'bbbbbbbbbbb'))?.draft.overrides.title).toBe('Edited');
    expect(await readRecord(23, 'ccccccccccc')).not.toBeNull();
  });

  it('fails with STORAGE_FAILED instead of evicting edited drafts when quota remains tight', async () => {
    await commitSnapshot(makeSnapshot(21, 'aaaaaaaaaaa', 'a'.repeat(5)), 0);
    await commitSnapshot(makeSnapshot(22, 'bbbbbbbbbbb', 'b'.repeat(50)), 0);
    await applyDraftPatch({
      tabId: 22,
      videoId: 'bbbbbbbbbbb',
      field: 'title',
      value: 'Edited',
      baseRevision: 1,
      epoch: 0,
    });

    sessionArea.maxBytes = sessionArea.totalBytes() + 100;

    const result = await commitSnapshot(makeSnapshot(23, 'ccccccccccc', 'c'.repeat(500)), 0);
    expect(result).toEqual({ ok: false, code: 'STORAGE_FAILED' });
    expect((await readRecord(22, 'bbbbbbbbbbb'))?.draft.overrides.title).toBe('Edited');
    expect(await readRecord(23, 'ccccccccccc')).toBeNull();
  });

  it('stores preferences locally with defaults and validation', async () => {
    expect(await readPreferences()).toEqual(DEFAULT_PREFERENCES);

    expect(await savePreferences({ schemaVersion: 1, theme: 'dark' })).toEqual({ ok: true });
    expect(await readPreferences()).toEqual({ schemaVersion: 1, theme: 'dark' });

    localArea.entries.set('preferences', { schemaVersion: 1, theme: 'neon' });
    expect(await readPreferences()).toEqual(DEFAULT_PREFERENCES);

    expect(
      await savePreferences({ schemaVersion: 1, theme: 'neon' as unknown as 'dark' }),
    ).toEqual({ ok: false, code: 'INVALID_PAYLOAD' });
  });

  it('removes the current-request marker on navigation invalidation', async () => {
    await setCurrentRequest({ tabId: 5, videoId, requestId: 1, sessionToken: 'token-1', epoch: 0 });
    expect(await readCurrentRequest(5)).not.toBeNull();
    expect(await clearCurrentRequest(5)).toEqual({ ok: true });
    expect(await readCurrentRequest(5)).toBeNull();
  });

  it('keeps locally stored preferences when session data clears', async () => {
    await savePreferences({ schemaVersion: 1, theme: 'dark' });
    await commitSnapshot(makeSnapshot(11, videoId), 0);
    expect(await clearAllSessionData()).toEqual({ ok: true, epoch: 1 });
    expect(await readPreferences()).toEqual({ schemaVersion: 1, theme: 'dark' });
  });
});
