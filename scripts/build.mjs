import { mkdir, rm, writeFile } from 'node:fs/promises';
import { watch as watchFile } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { verifyBuild } from './verify-build.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const watch = process.argv.includes('--watch');

async function loadManifest() {
  const module = await import(new URL(`../src/manifest.ts?t=${Date.now()}`, import.meta.url));
  return module.default;
}

async function writeManifest(manifest) {
  await mkdir(distDir, { recursive: true });
  await writeFile(path.join(distDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('built manifest.json from src/manifest.ts');
}

async function buildMode(mode, watching) {
  return build({
    configFile: path.join(rootDir, 'vite.config.ts'),
    mode,
    root: rootDir,
    build: watching ? { watch: {} } : {},
  });
}

async function main() {
  if (watch) {
    await writeManifest(await loadManifest());
    await Promise.all([
      buildMode('popup', true),
      buildMode('worker', true),
      buildMode('content', true),
    ]);
    watchFile(path.join(rootDir, 'src', 'manifest.ts'), () => {
      void loadManifest().then(writeManifest).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
      });
    });
    console.log('watching for changes — rebuilds go to dist/');
    return;
  }

  await rm(distDir, { recursive: true, force: true });
  await writeManifest(await loadManifest());
  for (const mode of ['popup', 'worker', 'content']) {
    await buildMode(mode, false);
  }
  await verifyBuild();
  console.log('build ok — dist/ is ready to load unpacked');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
