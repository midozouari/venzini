// Final video with ffmpeg: the captured frames as a constant 30 fps picture, each narration clip
// placed at its scene's start, a 1 s fade in and out, H.264 1080p with AAC sound.
import { writeFileSync } from 'node:fs';
import type { Frame } from './capture';
import { ffmpeg } from './tools';

export interface Placed {
  file: string;
  /** Seconds from the start of the video. */
  at: number;
}

const FADE = 1;

export async function assemble(opts: {
  frames: Frame[];
  t0: number;
  t1: number;
  clips: Placed[];
  listFile: string;
  out: string;
}) {
  const { frames, t0, t1, clips, listFile, out } = opts;
  // Each frame stays on screen until the next one was painted (the screencast only sends changes).
  const lines: string[] = [];
  let last = '';
  frames.forEach((f, i) => {
    const start = Math.max(f.t, t0);
    const end = Math.min(frames[i + 1]?.t ?? t1, t1);
    if (end <= start) return;
    last = f.file.replace(/\\/g, '/');
    lines.push(`file '${last}'`, `duration ${(end - start).toFixed(4)}`);
  });
  if (!last) throw new Error('No frames were captured.');
  lines.push(`file '${last}'`); // the concat format repeats the last file
  writeFileSync(listFile, lines.join('\n'));

  const total = t1 - t0;
  const inputs = clips.flatMap((c) => ['-i', c.file]);
  const delays = clips.map((c, i) => {
    const ms = Math.round(c.at * 1000);
    return `[${i + 1}:a]adelay=${ms}:all=1[a${i}]`;
  });
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:duration=longest,apad,atrim=0:${total.toFixed(3)},afade=t=in:st=0:d=${FADE},afade=t=out:st=${(total - FADE).toFixed(3)}:d=${FADE}[a]`;
  const video = `[0:v]fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${(total - FADE).toFixed(3)}:d=${FADE}[v]`;

  await ffmpeg([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    ...inputs,
    '-filter_complex',
    [video, ...delays, mix].join(';'),
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-r',
    '30',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    '-t',
    total.toFixed(3),
    out,
  ]);
}
