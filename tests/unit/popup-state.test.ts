import { describe, expect, it } from 'vitest';
import { createPopupState, popupReducer } from '../../src/popup/state';
import type { SessionState } from '../../src/shared/messages';
import type { MetadataSnapshot } from '../../src/domain/metadata';

const videoId = 'dQw4w9WgXcQ';

function makeSnapshot(): MetadataSnapshot {
  return {
    schemaVersion: 1,
    tabId: 5,
    requestId: 1,
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    pageType: 'watch',
    contentType: 'unknown',
    playbackStatus: 'unknown',
    extractedAt: '2026-10-05T18:00:00.000Z',
    title: { status: 'available', value: 'Source title', source: 'structured' },
    description: { status: 'unavailable', value: null, source: null },
    tags: { status: 'unavailable', value: null, source: null },
    hashtags: { status: 'unavailable', value: null, source: null },
    channelName: { status: 'unavailable', value: null, source: null },
    channelUrl: { status: 'unavailable', value: null, source: null },
    thumbnailUrl: { status: 'unavailable', value: null, source: null },
    publishDate: { status: 'unavailable', value: null, source: null },
    durationSeconds: { status: 'unavailable', value: null, source: null },
    views: { status: 'unavailable', value: null, source: null },
  };
}

function makeSession(): SessionState {
  return {
    snapshot: makeSnapshot(),
    draft: { tabId: 5, videoId, updatedAt: '2026-10-05T18:05:00.000Z', overrides: {} },
    revision: 1,
    epoch: 0,
  };
}

describe('popupReducer', () => {
  it('starts resolving and resets on re-resolve', () => {
    const initial = createPopupState('token-1');
    expect(initial.status).toBe('resolving');
    expect(initial.session).toBeNull();

    const ready = popupReducer(initial, {
      type: 'READY',
      session: makeSession(),
      staleFallback: true,
    });
    expect(ready.status).toBe('ready');
    expect(ready.staleFallback).toBe(true);

    const reset = popupReducer(ready, { type: 'RESOLVE_START' });
    expect(reset.status).toBe('resolving');
    expect(reset.session).toBeNull();
    expect(reset.staleFallback).toBe(false);
    expect(reset.errorCode).toBeNull();
  });

  it('moves through unsupported, extracting, and failed states', () => {
    const initial = createPopupState('token-1');

    const unsupported = popupReducer(initial, { type: 'UNSUPPORTED' });
    expect(unsupported.status).toBe('unsupported');
    expect(unsupported.errorCode).toBe('UNSUPPORTED_PAGE');

    const extracting = popupReducer(initial, { type: 'EXTRACT_START', tabId: 7 });
    expect(extracting.status).toBe('extracting');
    expect(extracting.tabId).toBe(7);
    expect(extracting.session).toBeNull();

    const failed = popupReducer(
      { ...extracting, session: makeSession() },
      { type: 'FAILED', code: 'ACCESS_DENIED' },
    );
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('ACCESS_DENIED');
    expect(failed.session).toBeNull();
  });

  it('keeps the session visible while refreshing and replaces it on READY', () => {
    const session = makeSession();
    const ready = popupReducer(createPopupState('token-1'), {
      type: 'READY',
      session,
      staleFallback: false,
    });

    const refreshing = popupReducer(ready, { type: 'REFRESH_START' });
    expect(refreshing.status).toBe('refreshing');
    expect(refreshing.session).toBe(session);

    const refreshed = popupReducer(refreshing, {
      type: 'READY',
      session: { ...session, revision: 2 },
      staleFallback: false,
    });
    expect(refreshed.status).toBe('ready');
    expect(refreshed.session?.revision).toBe(2);
    expect(refreshed.staleFallback).toBe(false);
  });

  it('tracks local overrides, save acknowledgements, and resets', () => {
    const ready = popupReducer(createPopupState('token-1'), {
      type: 'READY',
      session: makeSession(),
      staleFallback: false,
    });

    const edited = popupReducer(ready, {
      type: 'OVERRIDE_LOCAL',
      field: 'title',
      value: 'Edited title',
    });
    expect(edited.session?.draft.overrides.title).toBe('Edited title');
    expect(edited.draftStatus).toBe('saving');

    const editedList = popupReducer(edited, {
      type: 'OVERRIDE_LOCAL',
      field: 'tags',
      value: ['one', 'two'],
    });
    expect(editedList.session?.draft.overrides.tags).toEqual(['one', 'two']);

    const saved = popupReducer(editedList, { type: 'DRAFT_SAVED', revision: 5 });
    expect(saved.session?.revision).toBe(5);
    expect(saved.session?.draft.overrides.title).toBe('Edited title');
    expect(saved.draftStatus).toBe('saved');

    const failed = popupReducer(editedList, { type: 'DRAFT_SAVE_FAILED' });
    expect(failed.draftStatus).toBe('error');

    const single = popupReducer(editedList, { type: 'OVERRIDE_RESET_LOCAL', fields: ['title'] });
    expect(single.session && 'title' in single.session.draft.overrides).toBe(false);
    expect(single.session?.draft.overrides.tags).toEqual(['one', 'two']);

    const all = popupReducer(editedList, { type: 'OVERRIDE_RESET_LOCAL' });
    expect(all.session?.draft.overrides).toEqual({});

    const idle = popupReducer(saved, { type: 'DRAFT_STATUS_IDLE' });
    expect(idle.draftStatus).toBe('idle');
  });

  it('moves to the cleared state without a session and keeps the token', () => {
    const ready = popupReducer(createPopupState('token-1'), {
      type: 'READY',
      session: makeSession(),
      staleFallback: true,
    });

    const cleared = popupReducer(ready, { type: 'CLEARED' });
    expect(cleared.status).toBe('cleared');
    expect(cleared.session).toBeNull();
    expect(cleared.tabId).toBeNull();
    expect(cleared.staleFallback).toBe(false);
    expect(cleared.errorCode).toBeNull();
    expect(cleared.draftStatus).toBe('idle');
    expect(cleared.sessionToken).toBe('token-1');
  });
});
