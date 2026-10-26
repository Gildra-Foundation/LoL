import { afterEach, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const folders: string[] = [];
afterEach(() => { for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function snapshot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'riftden-validation-')); folders.push(dir);
  cpSync('apps/lol/src/data', dir, { recursive: true }); return dir;
}
function validate(dir: string) {
  return spawnSync(process.execPath, ['apps/lol/scripts/validate-data.mjs'], { encoding: 'utf8', env: { ...process.env, RIFTDEN_DATA_DIR: dir } });
}
it('rejects a snapshot with missing champions before publication', () => {
  const dir = snapshot(); const file = path.join(dir, 'ru/champions.json');
  const data = JSON.parse(readFileSync(file, 'utf8')); data.pop(); writeFileSync(file, JSON.stringify(data));
  const result = validate(dir); expect(result.status).toBe(1); expect(result.stderr).toContain('incomplete');
});
it('rejects executable item markup', () => {
  const dir = snapshot(); const file = path.join(dir, 'ru/items.json');
  const data = JSON.parse(readFileSync(file, 'utf8')); data[0].html = '<img src=x onerror=alert(1)>'; writeFileSync(file, JSON.stringify(data));
  const result = validate(dir); expect(result.status).toBe(1); expect(result.stderr).toContain('unsafe HTML');
});
