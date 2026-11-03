// pnpm demo:video – the MVP demo video, generated from docs/demo-script.md:
//   1. voice-over: one edge-tts clip per scene (cached by its text), with its measured duration;
//   2. recording: Playwright drives the production preview build (mock API) at 1920×1080 with a
//      visible cursor and scene titles; each scene lasts at least as long as its narration;
//   3. assembly: ffmpeg puts picture and voice together, with a fade in and out → demo-output/.
// Options: --skip-build (reuse apps/web/dist), --keep-frames (keep the captured frames).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { assemble } from './assemble';
import { startCapture } from './capture';
import { Human, sleep } from './human';
import { overlay } from './overlay';
import { SCENES } from './scenes';
import { readScript } from './script';
import { buildApp, startPreview } from './server';
import { durationOf, findEdgeTts, speak } from './tools';

/** A calm, natural male neural voice, slightly slower than its default pace. */
const VOICE = 'en-US-AndrewNeural';
const RATE = '-5%';
/** The voice starts a moment after the scene title appears; a short breath after it ends. */
const LEAD = 0.5;
const TAIL = 0.9;
const TITLE_MS = 3600;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = join(root, 'demo-output');
const args = new Set(process.argv.slice(2));
const log = (msg: string) => console.log(`[demo] ${msg}`);

async function main() {
  const scenes = readScript(join(root, 'docs', 'demo-script.md'));
  // The robot's actions must match the script's scenes; a changed script needs scenes.ts updated.
  const mismatch = scenes.find((s) => SCENES[s.n]?.name !== s.name);
  if (mismatch || scenes.length !== Object.keys(SCENES).length)
    throw new Error(
      `docs/demo-script.md and scenes.ts differ${mismatch ? ` at scene ${mismatch.n} "${mismatch.name}"` : ''}: update scenes.ts.`,
    );

  // 1. Voice-over.
  mkdirSync(join(out, 'audio'), { recursive: true });
  const python = await findEdgeTts();
  const voice: { file: string; seconds: number }[] = [];
  for (const s of scenes) {
    const hash = createHash('sha1')
      .update(`${VOICE}|${RATE}|${s.narration}`)
      .digest('hex')
      .slice(0, 10);
    const file = join(out, 'audio', `scene-${String(s.n).padStart(2, '0')}-${hash}.mp3`);
    // A cached clip is reused only if it can be read; anything else is spoken again.
    let seconds = existsSync(file) ? await durationOf(file).catch(() => 0) : 0;
    if (seconds <= 0) {
      log(`voice-over, scene ${s.n}…`);
      await speak(python, VOICE, RATE, s.narration, file);
      seconds = await durationOf(file);
    }
    voice.push({ file, seconds });
  }
  const spoken = voice.reduce((n, v) => n + v.seconds, 0);
  log(`voice ${VOICE} (${RATE}): ${scenes.length} clips, ${spoken.toFixed(1)} s of narration`);

  // 2. Recording.
  if (!args.has('--skip-build')) buildApp(root);
  const server = await startPreview(root);
  const framesDir = join(out, 'frames');
  rmSync(framesDir, { recursive: true, force: true });
  const browser = await chromium.launch();
  const timeline: { n: number; title: string; at: number; narration: number; length: number }[] =
    [];
  let t0 = 0;
  let t1 = 0;
  let frames;
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    await context.addInitScript(overlay);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const h = new Human(page);
    await page.goto(`${server.url}/login`);
    await page.getByRole('button', { name: 'Log in' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await h.place(1460, 820);
    await sleep(800);

    const capture = await startCapture(page, framesDir);
    frames = capture.frames;
    await sleep(500);
    t0 = Date.now() / 1000;
    for (const [i, s] of scenes.entries()) {
      const start = Date.now() / 1000;
      const showTitle = (ms: number) =>
        page.evaluate(([n, text, d]) => window.__demo?.title(n, text, d), [
          s.n,
          s.title,
          ms,
        ] as const);
      log(`scene ${s.n}: ${s.name}`);
      await showTitle(TITLE_MS);
      await SCENES[s.n]!.run({ page, h, showTitle });
      // Never cut the voice: the scene lasts at least as long as its narration.
      const minEnd = start + LEAD + voice[i]!.seconds + TAIL;
      const wait = minEnd - Date.now() / 1000;
      if (wait > 0) await sleep(wait * 1000);
      const end = Date.now() / 1000;
      timeline.push({
        n: s.n,
        title: s.title,
        at: +(start - t0).toFixed(3),
        narration: +voice[i]!.seconds.toFixed(3),
        length: +(end - start).toFixed(3),
      });
    }
    await sleep(1200);
    t1 = Date.now() / 1000;
    await capture.stop();
  } finally {
    await browser.close();
    server.stop();
  }

  // 3. Assembly.
  log(`assembling ${frames.length} frames, ${(t1 - t0).toFixed(1)} s…`);
  const file = join(out, 'venzini-demo.mp4');
  await assemble({
    frames,
    t0,
    t1,
    clips: timeline.map((s, i) => ({ file: voice[i]!.file, at: s.at + LEAD })),
    listFile: join(out, 'frames.txt'),
    out: file,
  });
  writeFileSync(
    join(out, 'timeline.json'),
    JSON.stringify(
      { voice: VOICE, rate: RATE, seconds: +(t1 - t0).toFixed(1), scenes: timeline },
      null,
      2,
    ),
  );
  if (!args.has('--keep-frames')) {
    rmSync(framesDir, { recursive: true, force: true });
    rmSync(join(out, 'frames.txt'), { force: true });
  }
  log(`done: ${file} (${Math.floor((t1 - t0) / 60)} min ${Math.round((t1 - t0) % 60)} s)`);
}

main().catch((e: unknown) => {
  console.error(`[demo] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
