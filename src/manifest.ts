const manifest = {
  manifest_version: 3,
  name: 'TubeMeta AI',
  version: '0.1.2',
  description: 'Extract, edit, and copy metadata from the current YouTube video. Local-only; no data leaves the browser.',
  minimum_chrome_version: '102',
  permissions: ['activeTab', 'scripting', 'storage', 'clipboardWrite'],
  background: {
    service_worker: 'worker.js',
    type: 'module',
  },
  action: {
    default_title: 'TubeMeta AI',
    default_popup: 'popup.html',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
} satisfies chrome.runtime.ManifestV3;

export default manifest;
