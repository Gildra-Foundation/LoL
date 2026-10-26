import { cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  if (args[i] === '-p' || args[i] === '--port') process.env.PORT = args[i + 1];
  else if (args[i] === '-H' || args[i] === '--hostname') process.env.HOSTNAME = args[i + 1];
  else throw new Error(`Unknown start option: ${args[i]}`);
}
const base = new URL('../', import.meta.url);
const standalone = new URL('.next/standalone/apps/lol/', base);
await cp(new URL('.next/static/', base), new URL('.next/static/', standalone), { recursive: true });
await cp(new URL('public/', base), new URL('public/', standalone), { recursive: true });
const child = spawn(process.execPath, [fileURLToPath(new URL('server.js', standalone))], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => { process.exitCode = code ?? 1; });
