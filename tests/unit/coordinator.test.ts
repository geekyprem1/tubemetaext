import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerReaderOutcome } from '../../src/content/readers/main-world';
import type { MetadataSnapshot } from '../../src/domain/metadata';
import type { SenderDescriptor } from '../../src/shared/messages';
import { FakeStorageArea } from '../helpers/fake-storage';

const sessionArea = new FakeStorageArea();
const localArea = new FakeStorageArea();

const videoId = 'dQw4w9WgXcQ';
const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

let tabUrl: string | null = watchUrl;
let tabMissing = false;
let readerResult: unknown = makeReaderOutcome();
let readerHook: (() => Promise<void>) | null = null;
let contentResponse: unknown = { ok: true, videoId, documentUrl: watchUrl, dom: null };
let contentShouldThrow = false;
let injectionShouldThrow = false;
const injectionLog: Array<{ world?: string; files?: string[] }> = [];

const relaySendMessage = vi.fn(async () => undefined);

vi.stubGlobal('chrome', {
  runtime: { id: 'extension-id', getManifest: () => ({ version: '0.1.0' }), sendMessage: relaySendMessage },
  tabs: {
    get: async (tabId: number) => {
      if (tabMissing) throw new Error('no tab');
      return { id: tabId, url: tabUrl ?? undefined };
    },
    sendMessage: async () => {
      if (contentShouldThrow) throw new Error('no receiving end');
      return contentResponse;
    },
  },
  scripting: {
    executeScript: async (options: { world?: string; files?: string[] }) => {
      injectionLog.push(options);
      if (injectionShouldThrow) throw new Error('cannot access contents');
      if (options.world === 'MAIN') {
        if (readerHook) {
          await readerHook();
        }
        return [{ frameId: 0, result: readerResult }];
      }
      return [{ frameId: 0, result: undefined }];
    },
  },
  storage: { session: sessionArea, local: localArea },
});

const { handleRuntimeMessage, extractionRetryPolicy } = await import(
  '../../src/background/coordinator'
);
const storage = await import('../../src/background/storage');

extractionRetryPolicy.delayMs = 2;

function makeReaderOutcome(): PlayerReaderOutcome {
  return {
    ok: true,
    videoId,
    title: 'Source title',
    description: 'Source description',
    keywords: ['one', 'two'],
    keywordsPresent: true,
    channelName: 'Channel',
    channelUrl: 'https://www.youtube.com/@channel',
    thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg',
    durationSeconds: 213,
    views: 42,
    publishDate: '2025-01-02',
    live: { isUpcoming: false, isLiveNow: false, isLiveContent: false },
    playabilityStatus: 'OK',
  };
}

function makeSnapshot(tabId: number, requestId: number): MetadataSnapshot {
  return {
    schemaVersion: 1,
    tabId,
    requestId,
    videoId,
    videoUrl: watchUrl,
    pageType: 'watch',
    contentType: 'unknown',
    playbackStatus: 'unknown',
    extractedAt: '2026-10-05T18:00:00.000Z',
    title: { status: 'available', value: 'Source title', source: 'structured' },
    description: { status: 'available', value: 'Source description', source: 'structured' },
    tags: { status: 'unavailable', value: null, source: null },
    hashtags: { status: 'available', value: ['#AI'], source: 'derived' },
    channelName: { status: 'available', value: 'Channel', source: 'structured' },
    channelUrl: { status: 'available', value: 'https://www.youtube.com/@channel', source: 'structured' },
    thumbnailUrl: { status: 'available', value: 'https://i.ytimg.com/vi/x/hq.jpg', source: 'structured' },
    publishDate: { status: 'available', value: '2025-01-02', source: 'structured' },
    durationSeconds: { status: 'available', value: 213, source: 'structured' },
    views: { status: 'available', value: 42, source: 'structured' },
  };
}

const extensionSender: SenderDescriptor = {
  id: 'extension-id',
  url: 'chrome-extension://extension-id/popup.html',
};
const context = { sender: extensionSender, extensionId: 'extension-id' };
const openMessage = { type: 'OPEN_VIDEO', protocolVersion: 1, tabId: 5, sessionToken: 'session-token-1' };

beforeEach(() => {
  sessionArea.entries = new Map();
  sessionArea.maxBytes = Number.POSITIVE_INFINITY;
  localArea.entries = new Map();
  tabUrl = watchUrl;
  tabMissing = false;
  readerResult = makeReaderOutcome();
  readerHook = null;
  contentResponse = { ok: true, videoId, documentUrl: watchUrl, dom: null };
  contentShouldThrow = false;
  injectionShouldThrow = false;
  injectionLog.length = 0;
  relaySendMessage.mockClear();
});

describe('OPEN_VIDEO coordination', () => {
  it('runs the identity envelope: allocation, marker, content install, reader, acceptance', async () => {
    const response = await handleRuntimeMessage(openMessage, context);

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response).toMatchObject({
      ok: true,
      state: {
        revision: 1,
        snapshot: {
          videoId,
          videoUrl: watchUrl,
          pageType: 'watch',
          contentType: 'unknown',
          playbackStatus: 'recorded',
          title: { status: 'available', value: 'Source title' },
          views: { status: 'available', value: 42 },
          durationSeconds: { status: 'available', value: 213 },
        },
        draft: { overrides: {} },
      },
    });

    const marker = await storage.readCurrentRequest(5);
    expect(marker).toEqual({
      tabId: 5,
      videoId,
      requestId: 1,
      sessionToken: 'session-token-1',
      epoch: 0,
    });

    const record = await storage.readRecord(5, videoId);
    expect(record?.revision).toBe(1);
    expect(record?.snapshot.title).toEqual({
      status: 'available',
      value: 'Source title',
      source: 'structured',
    });

    expect(injectionLog.some((entry) => entry.files?.[0] === 'content.js')).toBe(true);
    expect(injectionLog.some((entry) => entry.world === 'MAIN')).toBe(true);
  });

  it('allocates increasing request ids per tab and re-installs the content script per document', async () => {
    await handleRuntimeMessage(openMessage, context);
    await handleRuntimeMessage(openMessage, context);

    expect((await storage.readCurrentRequest(5))?.requestId).toBe(2);
    expect(injectionLog.filter((entry) => entry.files?.[0] === 'content.js')).toHaveLength(2);
  });

  it('rejects unsupported, inaccessible, and mismatched targets before extraction', async () => {
    tabUrl = 'https://example.test/watch?v=dQw4w9WgXcQ';
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'UNSUPPORTED_PAGE',
    });

    tabUrl = null;
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'ACCESS_DENIED',
    });

    tabMissing = true;
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });

    tabMissing = false;
    tabUrl = watchUrl;
    expect(
      await handleRuntimeMessage(
        { type: 'REFRESH_VIDEO', protocolVersion: 1, tabId: 5, videoId: 'abcdefghijk', sessionToken: 'session-token-1', epoch: 0 },
        context,
      ),
    ).toEqual({ ok: false, code: 'VIDEO_CHANGED' });
  });
});

describe('late result rejection', () => {
  it('discards a result when a newer request replaced the marker mid-flight', async () => {
    readerHook = async () => {
      await storage.setCurrentRequest({
        tabId: 5,
        videoId,
        requestId: 99,
        sessionToken: 'session-token-1',
        epoch: 0,
      });
    };
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'VIDEO_CHANGED',
    });
  });

  it('discards a result when the session data was cleared mid-flight', async () => {
    readerHook = async () => {
      await storage.clearAllSessionData();
    };
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'VIDEO_CHANGED',
    });
  });

  it('discards a result when the tab navigated to another video mid-flight', async () => {
    readerHook = async () => {
      tabUrl = 'https://www.youtube.com/watch?v=abcdefghijk';
    };
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'VIDEO_CHANGED',
    });
  });

  it('never lets an older A result replace the current video after A → B → A', async () => {
    let mainCalls = 0;
    let releaseGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    let markStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    readerHook = async () => {
      mainCalls += 1;
      if (mainCalls === 1) {
        markStarted();
        await gate;
      }
    };

    const run1 = handleRuntimeMessage(openMessage, context);
    await started;

    tabUrl = 'https://www.youtube.com/watch?v=abcdefghijk';
    readerResult = { ...makeReaderOutcome(), videoId: 'abcdefghijk' };
    contentResponse = { ok: true, videoId: 'abcdefghijk', documentUrl: tabUrl, dom: null };
    const run2 = await handleRuntimeMessage(openMessage, context);

    tabUrl = watchUrl;
    readerResult = makeReaderOutcome();
    contentResponse = { ok: true, videoId, documentUrl: watchUrl, dom: null };
    const run3 = await handleRuntimeMessage(openMessage, context);

    releaseGate();
    const result1 = await run1;

    expect(result1).toMatchObject({
      ok: true,
      staleFallback: true,
      state: { snapshot: { videoId, requestId: 3 } },
    });
    expect(run2).toMatchObject({ ok: true, state: { snapshot: { videoId: 'abcdefghijk' } } });
    expect(run3).toMatchObject({ ok: true, state: { snapshot: { videoId } } });
    expect((await storage.readRecord(5, videoId))?.snapshot.requestId).toBe(3);
    expect((await storage.readRecord(5, 'abcdefghijk'))?.snapshot.requestId).toBe(2);
  });

  it('surfaces reader and injection failures with controlled codes', async () => {
    readerResult = { ok: false, reason: 'PLAYER_ID_MISMATCH' };
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'VIDEO_CHANGED',
    });

    readerResult = undefined;
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'PAGE_NOT_READY',
    });

    readerResult = makeReaderOutcome();
    contentResponse = { ok: false, code: 'VIDEO_CHANGED' };
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'VIDEO_CHANGED',
    });

    contentResponse = 'garbage';
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'READER_FAILED',
    });

    contentResponse = { ok: true, videoId, documentUrl: watchUrl, dom: null };
    contentShouldThrow = true;
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'READER_FAILED',
    });

    contentShouldThrow = false;
    injectionShouldThrow = true;
    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'ACCESS_DENIED',
    });
  });
});

describe('draft, clear, and copy-verify handlers', () => {
  it('applies patches and resets through the repository with revision acknowledgements', async () => {
    await storage.commitSnapshot(makeSnapshot(5, 1), 0);

    const patched = await handleRuntimeMessage(
      {
        type: 'PATCH_DRAFT',
        protocolVersion: 1,
        tabId: 5,
        videoId,
        field: 'title',
        value: 'Edited title',
        sessionToken: 'session-token-1',
        epoch: 0,
        baseRevision: 1,
      },
      context,
    );
    expect(patched).toEqual({ ok: true, revision: 2 });

    const stale = await handleRuntimeMessage(
      {
        type: 'PATCH_DRAFT',
        protocolVersion: 1,
        tabId: 5,
        videoId,
        field: 'title',
        value: 'Again',
        sessionToken: 'session-token-1',
        epoch: 9,
        baseRevision: 2,
      },
      context,
    );
    expect(stale).toEqual({ ok: false, code: 'STALE_REVISION' });

    const reset = await handleRuntimeMessage(
      {
        type: 'RESET_DRAFT',
        protocolVersion: 1,
        tabId: 5,
        videoId,
        sessionToken: 'session-token-1',
        epoch: 0,
      },
      context,
    );
    expect(reset).toEqual({ ok: true, revision: 3 });
    expect((await storage.readRecord(5, videoId))?.draft.overrides).toEqual({});
  });

  it('clears session data through the coordinator', async () => {
    await storage.commitSnapshot(makeSnapshot(5, 1), 0);
    const cleared = await handleRuntimeMessage(
      { type: 'CLEAR_SESSION_DATA', protocolVersion: 1, sessionToken: 'session-token-1' },
      context,
    );
    expect(cleared).toEqual({ ok: true });
    expect(await storage.readRecord(5, videoId)).toBeNull();
    expect(await storage.readEpoch()).toBe(1);
  });

  it('verifies copy targets against the tab, record, and request id', async () => {
    const verifyMessage = {
      type: 'VERIFY_COPY_TARGET',
      protocolVersion: 1,
      tabId: 5,
      videoId,
      requestId: 1,
      sessionToken: 'session-token-1',
      epoch: 0,
    };

    expect(await handleRuntimeMessage(verifyMessage, context)).toEqual({
      ok: false,
      code: 'VIDEO_CHANGED',
    });

    await storage.commitSnapshot(makeSnapshot(5, 1), 0);
    expect(await handleRuntimeMessage(verifyMessage, context)).toEqual({ ok: true });

    expect(
      await handleRuntimeMessage({ ...verifyMessage, requestId: 2 }, context),
    ).toEqual({ ok: false, code: 'VIDEO_CHANGED' });

    tabUrl = 'https://www.youtube.com/watch?v=abcdefghijk';
    expect(await handleRuntimeMessage(verifyMessage, context)).toEqual({
      ok: false,
      code: 'VIDEO_CHANGED',
    });
  });
});

describe('envelope enforcement', () => {
  it('rejects malformed payloads and privileged commands from content senders', async () => {
    expect(
      await handleRuntimeMessage({ type: 'OPEN_VIDEO', protocolVersion: 1, tabId: 5 }, context),
    ).toEqual({ ok: false, code: 'INVALID_PAYLOAD' });

    const contentSender: SenderDescriptor = {
      id: 'extension-id',
      url: watchUrl,
      tabId: 5,
      frameId: 0,
    };
    const denied = await handleRuntimeMessage(openMessage, {
      sender: contentSender,
      extensionId: 'extension-id',
    });
    expect(denied).toEqual({ ok: false, code: 'INVALID_SENDER' });

    const invalidated = await handleRuntimeMessage(
      { type: 'VIDEO_INVALIDATED', protocolVersion: 1 },
      { sender: contentSender, extensionId: 'extension-id' },
    );
    expect(invalidated).toEqual({ ok: true });
  });
});

describe('bounded retries within the deadline', () => {
  it('retries transient readiness failures and resolves', async () => {
    let mainAttempts = 0;
    readerHook = async () => {
      mainAttempts += 1;
      readerResult = mainAttempts < 3 ? undefined : makeReaderOutcome();
    };

    const response = await handleRuntimeMessage(openMessage, context);
    expect(response.ok).toBe(true);
    expect(mainAttempts).toBe(3);
  });

  it('stops after the bounded attempt budget with an actionable code', async () => {
    let mainAttempts = 0;
    readerHook = async () => {
      mainAttempts += 1;
      readerResult = undefined;
    };

    const response = await handleRuntimeMessage(openMessage, context);
    expect(response).toEqual({ ok: false, code: 'PAGE_NOT_READY' });
    expect(mainAttempts).toBe(3);
  });

  it('maps persistent identity mismatch to VIDEO_CHANGED after the budget', async () => {
    let mainAttempts = 0;
    readerHook = async () => {
      mainAttempts += 1;
      readerResult = { ok: false, reason: 'PLAYER_ID_MISMATCH' };
    };

    const response = await handleRuntimeMessage(openMessage, context);
    expect(response).toEqual({ ok: false, code: 'VIDEO_CHANGED' });
    expect(mainAttempts).toBe(3);
  });
});

describe('navigation invalidation', () => {
  it('clears the current marker and relays the invalidation to extension pages', async () => {
    await storage.setCurrentRequest({
      tabId: 5,
      videoId,
      requestId: 1,
      sessionToken: 'session-token-1',
      epoch: 0,
    });

    const response = await handleRuntimeMessage(
      { type: 'VIDEO_INVALIDATED', protocolVersion: 1 },
      {
        sender: { id: 'extension-id', url: watchUrl, tabId: 5, frameId: 0 },
        extensionId: 'extension-id',
      },
    );

    expect(response).toEqual({ ok: true });
    expect(await storage.readCurrentRequest(5)).toBeNull();
    expect(relaySendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'VIDEO_INVALIDATED' }),
    );
  });
});

describe('same-video fallback', () => {
  it('retains a verified same-video snapshot when extraction fails', async () => {
    const seeded = makeSnapshot(5, 1);
    await storage.commitSnapshot(seeded, 0);

    readerHook = async () => {
      readerResult = { ok: false, reason: 'PLAYER_ID_MISMATCH' };
    };

    const response = await handleRuntimeMessage(openMessage, context);
    expect(response).toMatchObject({
      ok: true,
      staleFallback: true,
      state: { revision: 1, snapshot: seeded },
    });
    expect((await storage.readRecord(5, videoId))?.revision).toBe(1);
  });

  it('never serves another video record when the tab moved', async () => {
    await storage.commitSnapshot(makeSnapshot(5, 1), 0);
    tabUrl = 'https://www.youtube.com/watch?v=abcdefghijk';

    readerHook = async () => {
      readerResult = { ok: false, reason: 'PLAYER_ID_MISMATCH' };
    };

    expect(await handleRuntimeMessage(openMessage, context)).toEqual({
      ok: false,
      code: 'VIDEO_CHANGED',
    });
  });
});
