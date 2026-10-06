import { parseSupportedUrl } from '../domain/youtube-url';
import { PROTOCOL_VERSION, validateRuntimeMessage } from '../shared/messages';
import { createNavigationObserver } from './navigation';
import { readCurrentVideoDom } from './readers/video-dom';

declare global {
  interface Window {
    __tubemetaContentInstalled?: boolean;
  }
}

function install(): void {
  if (window.__tubemetaContentInstalled === true) return;
  window.__tubemetaContentInstalled = true;

  const observer = createNavigationObserver({
    addListener: (eventName, handler) => window.addEventListener(eventName, handler),
    removeListener: (eventName, handler) => window.removeEventListener(eventName, handler),
    onInvalidated: () => {
      void chrome.runtime
        .sendMessage({ type: 'VIDEO_INVALIDATED', protocolVersion: PROTOCOL_VERSION })
        .catch(() => undefined);
    },
    setTimer: (callback, ms) => window.setTimeout(callback, ms),
    clearTimer: (timer) => window.clearTimeout(timer),
  });

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const validation = validateRuntimeMessage(message);
    if (!validation.ok || validation.message.type !== 'READ_VIDEO') return false;

    const target = parseSupportedUrl(location.href);
    if (!target || target.videoId !== validation.message.videoId) {
      sendResponse({ ok: false, code: 'VIDEO_CHANGED' });
      return false;
    }
    sendResponse({
      ok: true,
      videoId: target.videoId,
      documentUrl: location.href,
      dom: readCurrentVideoDom(document, location.href),
    });
    observer.start();
    return false;
  });
}

install();
