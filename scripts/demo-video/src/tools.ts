// External tools: ffmpeg (the ffmpeg-static package, fetched by pnpm install) and edge-tts (Python).
import { execFile, spawn } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);

export const FFMPEG = (ffmpegPath as unknown as string | null) ?? 'ffmpeg';

/** Runs ffmpeg and fails with its last lines of output. */
export function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    let err = '';
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}):\n${err.slice(-2000)}`)),
    );
  });
}

/** Duration of a media file in seconds, read from ffmpeg's own report. */
export async function durationOf(file: string): Promise<number> {
  const out = await run(FFMPEG, ['-hide_banner', '-i', file, '-f', 'null', '-']).catch(
    (e: { stderr?: string }) => ({ stderr: e.stderr ?? '' }),
  );
  const times = [...out.stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
  const last = times.at(-1);
  if (!last) throw new Error(`Could not read the duration of ${file}.`);
  return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
}

/** The Python command that has edge-tts, or a clear message on how to install it. */
export async function findEdgeTts(): Promise<string> {
  for (const python of ['python', 'python3', 'py']) {
    try {
      await run(python, ['-m', 'edge_tts', '--version']);
      return python;
    } catch {
      // try the next name
    }
  }
  throw new Error(
    'edge-tts is not installed. Install it once with:  pip install edge-tts  (needs Python 3.8+).',
  );
}

/**
 * One voice clip. Microsoft's online voice sometimes answers with no audio, so it tries again a few
 * times; the clip is written to a temporary file first, so a failure never leaves a broken clip.
 */
export async function speak(
  python: string,
  voice: string,
  rate: string,
  text: string,
  out: string,
) {
  const tmp = `${out}.part`;
  for (let attempt = 1; ; attempt++) {
    try {
      await run(python, [
        '-m',
        'edge_tts',
        '--voice',
        voice,
        `--rate=${rate}`,
        '--text',
        text,
        '--write-media',
        tmp,
      ]);
      renameSync(tmp, out);
      return;
    } catch (e) {
      rmSync(tmp, { force: true });
      if (attempt >= 4)
        throw new Error(`edge-tts failed 4 times: ${(e as Error).message.slice(-300)}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}
