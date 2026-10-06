import { parseSupportedUrl } from '../../domain/youtube-url';

export interface DomCandidates {
  title: string | null;
  descriptionExcerpt: string | null;
  channelName: string | null;
  channelUrl: string | null;
  thumbnailUrl: string | null;
  viewsText: string | null;
  publishDateMeta: string | null;
  mediaDurationSeconds: number | null;
}

function textOf(root: ParentNode, selectors: readonly string[]): string | null {
  for (const selector of selectors) {
    const text = root.querySelector(selector)?.textContent?.trim();
    if (text) return text;
  }
  return null;
}

function absolutize(href: string | null, baseUrl: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function readThumbnail(doc: Document): string | null {
  return doc.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() ?? null;
}

function readPublishDateMeta(doc: Document): string | null {
  const meta =
    doc.querySelector('meta[itemprop="datePublished"]') ??
    doc.querySelector('meta[itemprop="uploadDate"]');
  const value = meta?.getAttribute('content')?.trim();
  return value ? value : null;
}

function readMediaDurationSeconds(scope: ParentNode): number | null {
  const video = scope.querySelector('video.html5-main-video') ?? scope.querySelector('video');
  const duration = (video as { duration?: unknown } | null)?.duration;
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : null;
}

function readViewsText(scope: ParentNode, doc: Document): string | null {
  const roots: ParentNode[] = scope === doc ? [doc] : [scope, doc];
  for (const root of roots) {
    for (const span of root.querySelectorAll('#info span')) {
      const text = span.textContent?.trim();
      if (text && /view/i.test(text)) return text;
    }
  }
  return null;
}

function readWatchDom(doc: Document, pageUrl: string): DomCandidates {
  const scope: ParentNode = doc.querySelector('ytd-watch-metadata') ?? doc;
  const ownerAnchor =
    scope.querySelector('#owner #channel-name a') ??
    scope.querySelector('ytd-video-owner-renderer #channel-name a');
  return {
    title: textOf(scope, ['h1 yt-formatted-string', '#title h1 yt-formatted-string']),
    descriptionExcerpt: textOf(scope, ['#description-inline-expander']),
    channelName: ownerAnchor?.textContent?.trim() || null,
    channelUrl: absolutize(ownerAnchor?.getAttribute('href') ?? null, pageUrl),
    thumbnailUrl: readThumbnail(doc),
    viewsText: readViewsText(scope, doc),
    publishDateMeta: readPublishDateMeta(doc),
    mediaDurationSeconds: readMediaDurationSeconds(doc),
  };
}

function readShortsDom(doc: Document, pageUrl: string): DomCandidates {
  const reels = doc.querySelectorAll('ytd-reel-video-renderer');
  const container =
    reels.length === 1 ? reels[0] : doc.querySelector('ytd-reel-video-renderer[is-active]');
  const scope: ParentNode = container ?? doc;
  const channelAnchor =
    scope.querySelector('a.ytAttributedStringLink[href^="/@"]') ??
    scope.querySelector('ytd-reel-player-header-renderer #channel-name a');
  const rawChannel = channelAnchor?.textContent?.trim() ?? null;
  return {
    title: textOf(scope, [
      'yt-shorts-video-title-view-model h1',
      'h1.ytShortsVideoTitleViewModelShortsVideoTitle',
      'ytd-reel-player-header-renderer h2',
      '#shorts-title',
    ]),
    descriptionExcerpt: null,
    channelName: rawChannel ? rawChannel.replace(/^@/, '') : null,
    channelUrl: absolutize(channelAnchor?.getAttribute('href') ?? null, pageUrl),
    thumbnailUrl: readThumbnail(doc),
    viewsText: null,
    publishDateMeta: readPublishDateMeta(doc),
    mediaDurationSeconds: readMediaDurationSeconds(scope),
  };
}

export function readCurrentVideoDom(doc: Document, pageUrl: string): DomCandidates | null {
  const target = parseSupportedUrl(pageUrl);
  if (!target) return null;
  return target.pageType === 'shorts' ? readShortsDom(doc, pageUrl) : readWatchDom(doc, pageUrl);
}
