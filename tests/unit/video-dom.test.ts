import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { readCurrentVideoDom } from '../../src/content/readers/video-dom';

const videoId = 'dQw4w9WgXcQ';
const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
const shortsUrl = 'https://www.youtube.com/shorts/n2c1NroYCLs';

function makeDocument(headHtml: string, bodyHtml: string, url: string): Document {
  const window = new Window({ url });
  window.document.head.innerHTML = headHtml;
  window.document.body.innerHTML = bodyHtml;
  return window.document as unknown as Document;
}

describe('readCurrentVideoDom (watch)', () => {
  it('reads the validated watch-page sources without relying on collapsed completeness', () => {
    const doc = makeDocument(
      '<meta property="og:image" content="https://i.ytimg.com/vi/x/hq.jpg">' +
        '<meta itemprop="datePublished" content="2009-10-24T23:57:33-07:00">',
      `
      <video class="html5-main-video"></video>
      <ytd-watch-metadata>
        <h1><yt-formatted-string>Fixture title</yt-formatted-string></h1>
        <div id="description-inline-expander">Collapsed excerpt text</div>
        <div id="owner"><div id="channel-name"><a href="/channel/UCTEST">Fixture channel</a></div></div>
        <div id="info"><span>1,234,567 views</span><span>Download</span></div>
      </ytd-watch-metadata>
      `,
      watchUrl,
    );
    Object.defineProperty(doc.querySelector('video'), 'duration', { value: 213.061 });

    expect(readCurrentVideoDom(doc, watchUrl)).toEqual({
      title: 'Fixture title',
      descriptionExcerpt: 'Collapsed excerpt text',
      channelName: 'Fixture channel',
      channelUrl: 'https://www.youtube.com/channel/UCTEST',
      thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg',
      viewsText: '1,234,567 views',
      publishDateMeta: '2009-10-24T23:57:33-07:00',
      mediaDurationSeconds: 213.061,
    });
  });
});

describe('readCurrentVideoDom (shorts)', () => {
  it('reads the active deep-link reel through the view-model layout', () => {
    const doc = makeDocument(
      '',
      `
      <ytd-reel-video-renderer>
        <div id="short-video-container"><video></video></div>
        <div id="experiment-overlay">
          <a class="ytAttributedStringLink" href="/@fixturechannel/shorts">@fixturechannel</a>
          <yt-shorts-video-title-view-model><h1><span>Fixture short title</span></h1></yt-shorts-video-title-view-model>
        </div>
      </ytd-reel-video-renderer>
      `,
      shortsUrl,
    );
    Object.defineProperty(doc.querySelector('video'), 'duration', { value: 43.5 });

    expect(readCurrentVideoDom(doc, shortsUrl)).toEqual({
      title: 'Fixture short title',
      descriptionExcerpt: null,
      channelName: 'fixturechannel',
      channelUrl: 'https://www.youtube.com/@fixturechannel/shorts',
      thumbnailUrl: null,
      viewsText: null,
      publishDateMeta: null,
      mediaDurationSeconds: 43.5,
    });
  });

  it('selects the active reel and ignores preloaded neighbours in the feed layout', () => {
    const doc = makeDocument(
      '',
      `
      <ytd-reel-video-renderer>
        <yt-shorts-video-title-view-model><h1><span>Preloaded neighbour</span></h1></yt-shorts-video-title-view-model>
      </ytd-reel-video-renderer>
      <ytd-reel-video-renderer is-active>
        <yt-shorts-video-title-view-model><h1><span>Active short</span></h1></yt-shorts-video-title-view-model>
      </ytd-reel-video-renderer>
      `,
      shortsUrl,
    );

    expect(readCurrentVideoDom(doc, shortsUrl)?.title).toBe('Active short');
  });
});

describe('readCurrentVideoDom (guards)', () => {
  it('returns null for unsupported pages and tolerates missing structures', () => {
    const doc = makeDocument('', '<div>nothing here</div>', watchUrl);
    expect(readCurrentVideoDom(doc, 'https://example.test/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(readCurrentVideoDom(doc, watchUrl)).toEqual({
      title: null,
      descriptionExcerpt: null,
      channelName: null,
      channelUrl: null,
      thumbnailUrl: null,
      viewsText: null,
      publishDateMeta: null,
      mediaDurationSeconds: null,
    });
  });
});
