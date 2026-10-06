import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

function fail(message) {
  throw new Error(`verify-build: ${message}`);
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkManifestReferences() {
  const manifestRaw = await readFile(path.join(distDir, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);

  const referenced = new Set([
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ]);
  for (const ref of referenced) {
    if (typeof ref !== 'string') continue;
    if (!(await fileExists(path.join(distDir, ref)))) {
      fail(`manifest references a missing file: ${ref}`);
    }
  }

  const popupPath = manifest.action?.default_popup ?? 'popup.html';
  const popupHtml = await readFile(path.join(distDir, popupPath), 'utf8');
  const assetRefs = [...popupHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of assetRefs) {
    if (/^https?:/.test(ref)) continue;
    const local = ref.startsWith('/') ? ref.slice(1) : ref;
    if (!(await fileExists(path.join(distDir, local)))) {
      fail(`${popupPath} references a missing asset: ${ref}`);
    }
  }

  return manifest;
}

async function readBundles(manifest) {
  const workerName = manifest.background?.service_worker ?? 'worker.js';
  const workerSource = await readFile(path.join(distDir, workerName), 'utf8');
  const contentSource = await readFile(path.join(distDir, 'content.js'), 'utf8');

  for (const [name, source] of [
    [workerName, workerSource],
    ['content.js', contentSource],
  ]) {
    if (/^\s*import[\s(]/m.test(source) || /\bfrom\s*['"]/.test(source) || /\bimport\s*\(/.test(source)) {
      fail(`${name} contains an unresolved import or dynamic import; runtime chunk fetching is not allowed`);
    }
  }

  return { workerSource, contentSource };
}

function checkContentBundle(contentSource) {
  let listeners = 0;
  const context = vm.createContext({
    chrome: {
      runtime: {
        onMessage: {
          addListener: () => {
            listeners += 1;
          },
        },
      },
    },
    window: {},
    document: { title: 'verify-build fixture' },
    console,
  });
  vm.runInContext(contentSource, context);
  vm.runInContext(contentSource, context);
  if (listeners !== 1) fail('content.js installed duplicate listeners when re-injected into the same document');
  if (context.window.__tubemetaContentInstalled !== true) {
    fail('content.js did not set its idempotent install guard');
  }
}

function extractFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) fail(`main-world reader function "${name}" not found in the bundled worker`);

  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  fail('unbalanced braces while extracting the main-world reader');
  return '';
}

function checkMainWorldReader(workerSource) {
  const functionSource = extractFunctionSource(workerSource, 'readCurrentPlayerResponse');

  const fixture = {
    videoDetails: {
      videoId: 'dQw4w9WgXcQ',
      title: 'Verify build fixture',
      shortDescription: 'Line one\nLine two',
      keywords: ['one', 'two'],
      author: 'Channel',
      lengthSeconds: '213',
      viewCount: '1823548699',
      thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/x/hq.jpg' }] },
    },
    microformat: {
      playerMicroformatRenderer: {
        ownerProfileUrl: 'http://www.youtube.com/@channel',
        publishDate: '2025-09-01T10:20:30-07:00',
      },
    },
    playabilityStatus: { status: 'OK' },
  };

  const context = vm.createContext({
    window: { ytInitialPlayerResponse: fixture },
    document: { getElementById: () => null },
    URL,
    Date,
    Number,
    Set,
    Map,
    Promise,
    console,
  });
  const reader = vm.runInContext(`(${functionSource})`, context);
  const result = reader('dQw4w9WgXcQ');

  if (!result || result.ok !== true) fail('the bundled main-world reader failed on fixture input');
  if (result.publishDate !== '2025-09-01') {
    fail(`bundled reader date normalization failed: ${String(result.publishDate)}`);
  }
  if (result.durationSeconds !== 213 || result.views !== 1823548699) {
    fail('bundled reader numeric parsing failed');
  }
  if (result.title !== 'Verify build fixture' || result.keywordsPresent !== true) {
    fail('bundled reader field extraction failed');
  }

  const spaContext = vm.createContext({
    window: { ytInitialPlayerResponse: { videoDetails: { videoId: 'StaleStale1', title: 'stale page-load response' } } },
    document: {
      getElementById: (id) =>
        id === 'movie_player' ? { getPlayerResponse: () => fixture } : null,
    },
    URL,
    Date,
    Number,
    Set,
    Map,
    Promise,
    console,
  });
  const spaReader = vm.runInContext(`(${functionSource})`, spaContext);
  const spaResult = spaReader('dQw4w9WgXcQ');
  if (!spaResult || spaResult.ok !== true || spaResult.title !== 'Verify build fixture') {
    fail('bundled reader must prefer the live player response over a stale initial response (SPA navigation)');
  }

  return { stringsValidated: true };
}

export async function verifyBuild() {
  const manifest = await checkManifestReferences();
  const { workerSource, contentSource } = await readBundles(manifest);
  checkContentBundle(contentSource);
  checkMainWorldReader(workerSource);
  console.log('verify-build ok: manifest references, bundles, and the serialized main-world reader all pass');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyBuild().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
