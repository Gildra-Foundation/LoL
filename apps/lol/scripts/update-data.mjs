import { cp, mkdtemp, rename, rm, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const scripts = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(scripts, '../src/data');
const lock = source + '.update-lock';
await mkdir(lock); // concurrent updates fail before touching data
let stage;
const backup = source + '.previous';
try {
  stage = await mkdtemp(source + '.stage-');
  await cp(source, stage, { recursive: true });
  for (const script of ['fetch-data.mjs', 'fetch-items.mjs', 'fetch-regions.mjs', 'fetch-skins.mjs', 'validate-data.mjs']) {
    const result = spawnSync(process.execPath, [path.join(scripts, script)], {
      stdio: 'inherit', env: { ...process.env, RIFTDEN_DATA_DIR: stage },
    });
    if (result.status !== 0) throw new Error(`${script} failed: original data unchanged`);
  }
  await rm(backup, { recursive: true, force: true });
  await rename(source, backup);
  try { await rename(stage, source); stage = undefined; }
  catch (error) { await rename(backup, source); throw error; }
  console.log('Validated snapshot installed; previous data retained at ' + backup);
} finally {
  if (stage) await rm(stage, { recursive: true, force: true });
  await rm(lock, { recursive: true, force: true });
}
