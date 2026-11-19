// VICE PANELS — make.fun handoff program (Node 22, standard library only).
//
// What it does: place the finished entry into the output directory — the
// offline app under app/ and the judge-facing screenshots under
// screenshots/ — then write dossier.json with the vendored make.fun
// library, byte for byte the way the bounty's scorer rebuilds it.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), {
  recursive: true,
});

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, caps));

console.log('VICE PANELS handed in ->', outDir);
