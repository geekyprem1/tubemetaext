import type { PageType } from './metadata';

const HOST_ALLOWLIST = new Set(['youtube.com', 'www.youtube.com']);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export interface VideoTarget {
  videoId: string;
  pageType: PageType;
  canonicalUrl: string;
}

export function isYoutubeHostname(hostname: string): boolean {
  return HOST_ALLOWLIST.has(hostname);
}

export function videoIdPatternMatches(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}

export function parseSupportedUrl(rawUrl: string): VideoTarget | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !HOST_ALLOWLIST.has(url.hostname)) return null;

  let pageType: PageType;
  let videoId: string | null;
  if (url.pathname === '/watch') {
    pageType = 'watch';
    videoId = url.searchParams.get('v');
  } else {
    const match = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/);
    if (!match) return null;
    pageType = 'shorts';
    videoId = match[1];
  }
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) return null;

  const canonicalUrl =
    pageType === 'shorts'
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;
  return { videoId, pageType, canonicalUrl };
}
