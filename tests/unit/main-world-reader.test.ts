import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { readCurrentPlayerResponse } from '../../src/content/readers/main-world';

const videoId = 'dQw4w9WgXcQ';

interface ReaderResult {
  ok: boolean;
  [key: string]: unknown;
}

interface ReaderHarness {
  playerResponse?: unknown;
  playerMissing?: boolean;
  playerThrows?: boolean;
}

function runSerialized(
  fixture: unknown,
  expectedVideoId: string,
  harness: ReaderHarness = {},
): ReaderResult {
  const documentMock = {
    getElementById: (id: string) => {
      if (id !== 'movie_player' || harness.playerMissing) return null;
      return {
        getPlayerResponse: () => {
          if (harness.playerThrows) throw new Error('player not ready');
          return harness.playerResponse;
        },
      };
    },
  };
  const context = vm.createContext({
    window: { ytInitialPlayerResponse: fixture },
    document: documentMock,
    URL,
    Date,
    Number,
    Set,
    Map,
    Promise,
    console,
  });
  const factory = vm.runInContext(
    `(${readCurrentPlayerResponse.toString()})`,
    context,
  ) as (id: string) => ReaderResult;
  return factory(expectedVideoId);
}

function makeFixture(): TestFixture {
  return {
    videoDetails: {
      videoId,
      title: 'Build with #AI and #हिंदी',
      shortDescription: 'Line one\nhttps://example.test/path#fragment',
      keywords: ['AI', 'Hindi video'],
      author: 'Example channel',
      lengthSeconds: '164',
      viewCount: '123456',
      thumbnail: {
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/x/default.jpg' },
          { url: 'https://i.ytimg.com/vi/x/maxres.jpg' },
        ],
      },
    },
    microformat: {
      playerMicroformatRenderer: {
        ownerProfileUrl: 'http://www.youtube.com/@example',
        publishDate: '2025-09-01T10:20:30-07:00',
        isLiveContent: false,
      },
    },
    playabilityStatus: { status: 'OK' },
  };
}

interface TestFixture {
  videoDetails: Record<string, unknown>;
  microformat: { playerMicroformatRenderer: Record<string, unknown> };
  playabilityStatus: { status: string };
}

describe('readCurrentPlayerResponse (serialized like chrome.scripting.executeScript)', () => {
  it('survives function serialization without closure dependencies and parses a live-shaped payload', () => {
    const result = runSerialized(makeFixture(), videoId);

    expect(result.ok).toBe(true);
    expect(result.videoId).toBe(videoId);
    expect(result.title).toBe('Build with #AI and #हिंदी');
    expect(result.description).toBe('Line one\nhttps://example.test/path#fragment');
    expect(result.keywords).toEqual(['AI', 'Hindi video']);
    expect(result.keywordsPresent).toBe(true);
    expect(result.durationSeconds).toBe(164);
    expect(result.views).toBe(123456);
    expect(result.publishDate).toBe('2025-09-01');
    expect(result.thumbnailUrl).toBe('https://i.ytimg.com/vi/x/maxres.jpg');
    expect(result.playabilityStatus).toBe('OK');
  });

  it('rejects a mismatched video id', () => {
    const result = runSerialized(makeFixture(), 'abcdefghijk');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('PLAYER_ID_MISMATCH');
  });

  it('prefers the LIVE player response when the initial page response is stale (SPA navigation)', () => {
    const staleInitial = makeFixture();
    staleInitial.videoDetails.videoId = 'StaleStale1';
    staleInitial.videoDetails.title = 'Previous video from the initial page load';

    const livePlayer = makeFixture();

    const result = runSerialized(staleInitial, videoId, { playerResponse: livePlayer });
    expect(result.ok).toBe(true);
    expect(result.videoId).toBe(videoId);
    expect(result.title).toBe('Build with #AI and #हिंदी');
  });

  it('falls back to the initial page response when the player element is absent (fresh load)', () => {
    const result = runSerialized(makeFixture(), videoId, { playerMissing: true });
    expect(result.ok).toBe(true);
    expect(result.videoId).toBe(videoId);
  });

  it('falls back to the initial page response when the player query throws during a transition', () => {
    const result = runSerialized(makeFixture(), videoId, { playerThrows: true });
    expect(result.ok).toBe(true);
    expect(result.videoId).toBe(videoId);
  });

  it('rejects when both the live player and the initial response are stale (still loading the new video)', () => {
    const staleInitial = makeFixture();
    staleInitial.videoDetails.videoId = 'StaleStale1';
    const stalePlayer = makeFixture();
    stalePlayer.videoDetails.videoId = 'StaleStale2';

    const result = runSerialized(staleInitial, videoId, { playerResponse: stalePlayer });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('PLAYER_ID_MISMATCH');
  });

  it('ignores a non-object player response and uses the initial response', () => {
    const result = runSerialized(makeFixture(), videoId, { playerResponse: 'garbage' });
    expect(result.ok).toBe(true);
    expect(result.videoId).toBe(videoId);
  });

  it('keeps absent keywords unavailable rather than empty and tolerates missing microformat data', () => {
    const fixture = makeFixture();
    fixture.videoDetails.keywords = undefined;
    fixture.microformat.playerMicroformatRenderer = {};

    const result = runSerialized(fixture, videoId);
    expect(result.ok).toBe(true);
    expect(result.keywords).toBeNull();
    expect(result.keywordsPresent).toBe(false);
    expect(result.publishDate).toBeNull();
    expect(result.channelUrl).toBeNull();
  });
});
