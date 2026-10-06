import { describe, expect, it } from 'vitest';
import { parseSupportedUrl } from '../../src/domain/youtube-url';

const videoId = 'dQw4w9WgXcQ';

describe('parseSupportedUrl', () => {
  it('canonicalizes supported watch and shorts routes and strips tracking parameters', () => {
    const watch = parseSupportedUrl(`https://www.youtube.com/watch?list=PLabc&v=${videoId}&t=90`);
    expect(watch).toEqual({
      videoId,
      pageType: 'watch',
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });

    const shorts = parseSupportedUrl(`https://youtube.com/shorts/${videoId}?si=tracking`);
    expect(shorts).toEqual({
      videoId,
      pageType: 'shorts',
      canonicalUrl: `https://www.youtube.com/shorts/${videoId}`,
    });
  });

  it('rejects unsupported hosts, routes, and lookalikes', () => {
    const rejected = [
      `http://www.youtube.com/watch?v=${videoId}`,
      `https://youtube.com.evil.test/watch?v=${videoId}`,
      `https://m.youtube.com/watch?v=${videoId}`,
      `https://youtu.be/${videoId}`,
      `https://www.youtube.com/shorts/${videoId}extra`,
      `https://www.youtube.com/watch?v=short`,
      'not a url',
    ];
    for (const url of rejected) {
      expect(parseSupportedUrl(url), url).toBeNull();
    }
  });
});
