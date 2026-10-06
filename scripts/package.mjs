import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const manifest = JSON.parse(await readFile(path.join(rootDir, 'dist', 'manifest.json'), 'utf8'));

  const zip = new AdmZip();
  zip.addLocalFolder(path.join(rootDir, 'dist'));

  const releaseDir = path.join(rootDir, 'release');
  await mkdir(releaseDir, { recursive: true });

  const archivePath = path.join(releaseDir, `tubemeta-ai-v${manifest.version}.zip`);
  zip.writeZip(archivePath);

  const bytes = await readFile(archivePath);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const entries = zip.getEntries().map((entry) => entry.entryName).sort();

  await writeFile(`${archivePath}.sha256`, `${checksum}  ${path.basename(archivePath)}\n`, 'utf8');

  console.log(`packaged release/${path.basename(archivePath)}`);
  console.log(`version ${manifest.version} · ${entries.length} entries · ${bytes.length} bytes`);
  console.log(`sha256 ${checksum}`);
  for (const entry of entries) {
    console.log(`  ${entry}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
