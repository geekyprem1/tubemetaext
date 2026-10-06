import type { SenderDescriptor } from '../shared/messages';
import { handleRuntimeMessage } from './coordinator';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderDescriptor: SenderDescriptor = {
    id: sender.id,
    url: sender.url,
    tabId: sender.tab?.id,
    frameId: sender.frameId,
  };
  void handleRuntimeMessage(message, { sender: senderDescriptor, extensionId: chrome.runtime.id }).then(
    sendResponse,
    () => {
      sendResponse({ ok: false, code: 'INVALID_PAYLOAD' });
    },
  );
  return true;
});
