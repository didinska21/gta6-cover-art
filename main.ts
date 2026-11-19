// VICE PANELS — handoff program for the make.fun gta6-cover-art-01 entry.
//
// What it does, in order:
//   1. Works out where this repository lives and where the grader wants
//      the finished entry (MAKEFUN_OUTPUT_DIR when set, /output otherwise).
//   2. Copies the static app (app/) and the judged renders (screenshots/)
//      into that directory, untouched.
//   3. Asks the vendored make.fun library to describe the copied tree and
//      writes the result as dossier.json next to them.
//
// The dossier bytes depend only on the copied files, so running this
// program twice over the same tree yields the same dossier.json.

import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(outDir, { recursive: true });
for (const part of ["app", "screenshots"]) {
  cpSync(join(repoRoot, part), join(outDir, part), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outDir, "dossier.json"), dossier);

console.log(`VICE PANELS entry handed in at ${outDir}`);
