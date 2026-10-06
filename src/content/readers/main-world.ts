export interface PlayerReaderResult {
  ok: true;
  videoId: string;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  keywordsPresent: boolean;
  channelName: string | null;
  channelUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  views: number | null;
  publishDate: string | null;
  live: {
    isUpcoming: boolean;
    isLiveNow: boolean;
    isLiveContent: boolean | undefined;
  };
  playabilityStatus: string | null;
}

export interface PlayerReaderFailure {
  ok: false;
  reason: 'PLAYER_ID_MISMATCH';
}

export type PlayerReaderOutcome = PlayerReaderResult | PlayerReaderFailure;

interface PlayerResponseShape {
  videoDetails?: {
    videoId?: string;
    title?: unknown;
    shortDescription?: unknown;
    keywords?: unknown;
    author?: unknown;
    lengthSeconds?: unknown;
    viewCount?: unknown;
    thumbnail?: { thumbnails?: Array<{ url?: unknown }> };
  };
  microformat?: {
    playerMicroformatRenderer?: {
      ownerProfileUrl?: unknown;
      publishDate?: unknown;
      uploadDate?: unknown;
      isLiveContent?: unknown;
      liveBroadcastDetails?: { isUpcoming?: unknown; isLiveNow?: unknown };
    };
  };
  playabilityStatus?: { status?: unknown };
}

export function readCurrentPlayerResponse(expectedVideoId: string): PlayerReaderOutcome {
  function toExactInteger(value: unknown): number | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const text = String(value);
    if (!/^\d+$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  function toDateOnly(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const match = value.match(
      /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
    );
    const datePart = match ? match[1] : value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    const date = new Date(`${datePart}T00:00:00.000Z`);
    return date.toISOString().slice(0, 10) === datePart ? datePart : null;
  }

  function readResponseFromPlayerElement(element: Element | null): PlayerResponseShape | undefined {
    if (!element) return undefined;
    const player = element as HTMLElement & {
      getPlayerResponse?: () => unknown;
      getPlayer?: () => { getPlayerResponse?: () => unknown } | undefined;
    };
    try {
      if (typeof player.getPlayerResponse === 'function') {
        const response = player.getPlayerResponse();
        if (response && typeof response === 'object') return response as PlayerResponseShape;
      }
    } catch {
      // fall through to the player API
    }
    try {
      if (typeof player.getPlayer === 'function') {
        const api = player.getPlayer();
        if (api && typeof api.getPlayerResponse === 'function') {
          const response = api.getPlayerResponse();
          if (response && typeof response === 'object') return response as PlayerResponseShape;
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  const playerElements: Array<Element | null> = [
    document.getElementById('movie_player'),
    document.getElementById('shorts-player'),
    ...Array.from(document.querySelectorAll('ytd-player')),
  ];
  const candidates: Array<PlayerResponseShape | undefined> = [
    ...playerElements.map((element) => readResponseFromPlayerElement(element)),
    (window as unknown as { ytInitialPlayerResponse?: PlayerResponseShape }).ytInitialPlayerResponse,
  ];
  let response: PlayerResponseShape | undefined;
  for (const candidate of candidates) {
    if (candidate?.videoDetails?.videoId === expectedVideoId) {
      response = candidate;
      break;
    }
  }
  const details = response?.videoDetails;
  const matchedVideoId = details?.videoId;
  if (!response || !details || typeof matchedVideoId !== 'string') {
    return { ok: false, reason: 'PLAYER_ID_MISMATCH' };
  }

  const microformat = response?.microformat?.playerMicroformatRenderer ?? {};
  const keywordsPresent = Array.isArray(details.keywords);
  const thumbs = Array.isArray(details.thumbnail?.thumbnails) ? details.thumbnail.thumbnails : [];
  const liveDetails = microformat.liveBroadcastDetails ?? {};
  const lastThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1] : undefined;

  return {
    ok: true,
    videoId: matchedVideoId,
    title: typeof details.title === 'string' ? details.title : null,
    description: typeof details.shortDescription === 'string' ? details.shortDescription : null,
    keywords: keywordsPresent ? (details.keywords as string[]) : null,
    keywordsPresent,
    channelName: typeof details.author === 'string' ? details.author : null,
    channelUrl: typeof microformat.ownerProfileUrl === 'string' ? microformat.ownerProfileUrl : null,
    thumbnailUrl: lastThumb && typeof lastThumb.url === 'string' ? lastThumb.url : null,
    durationSeconds: toExactInteger(details.lengthSeconds),
    views: toExactInteger(details.viewCount),
    publishDate: toDateOnly(microformat.publishDate) ?? toDateOnly(microformat.uploadDate),
    live: {
      isUpcoming: liveDetails.isUpcoming === true,
      isLiveNow: liveDetails.isLiveNow === true,
      isLiveContent: microformat.isLiveContent === false ? false : undefined,
    },
    playabilityStatus:
      typeof response?.playabilityStatus?.status === 'string'
        ? response.playabilityStatus.status
        : null,
  };
}
