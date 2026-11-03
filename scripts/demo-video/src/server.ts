// Builds the web app and serves the production preview build (with the mock API) for the recording.
// Port 4174, so it never clashes with the end-to-end test server (4173).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { sleep } from './human';

export const PORT = 4174;
const WIN = process.platform === 'win32';

export function buildApp(root: string): void {
  const r = spawnSync('pnpm', ['--filter', '@venzini/web', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: WIN,
  });
  if (r.status !== 0) throw new Error('The web app build failed.');
}

export async function startPreview(root: string): Promise<{ url: string; stop: () => void }> {
  const child: ChildProcess = spawn(
    'pnpm',
    ['--filter', '@venzini/web', 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: root, stdio: 'ignore', shell: WIN },
  );
  const url = `http://localhost:${PORT}`;
  const stop = () => {
    if (child.pid === undefined) return;
    if (WIN) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  };
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop };
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  stop();
  throw new Error(`The preview server did not start on ${url}.`);
}
