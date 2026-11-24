import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Bind an OS-selected port and use a disposable database: never attach to a user's demo.
export async function startShop() {
  const dir = await mkdtemp(path.join(tmpdir(), 'chapter-co-browser-'));
  const database = path.join(dir, 'shop.sqlite3');
  const server = spawn(process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3'),
    ['-u', 'app.py', '--port', '0'], { cwd: project, env: { ...process.env, SHOP_DB: database }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { server.kill(); reject(new Error(`Server startup timed out: ${log}`)); }, 15000);
    server.stdout.on('data', data => {
      log += data;
      const match = log.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    server.stderr.on('data', data => { log += data; });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited (${code}): ${log}`)); });
  }).catch(async error => { server.kill(); await rm(dir, { recursive: true, force: true }); throw error; });
  return { url, database, async close() {
    if (server.exitCode === null && server.signalCode === null) {
      await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
    }
    await rm(dir, { recursive: true, force: true });
  }};
}
