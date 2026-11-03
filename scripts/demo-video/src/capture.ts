// Screen capture straight from Chromium (DevTools screencast): every painted frame as a high
// quality JPEG with its timestamp. Sharper than Playwright's built-in video for small text; the
// frames are turned into a constant 30 fps video by ffmpeg (assemble.ts).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CDPSession, Page } from '@playwright/test';

export interface Frame {
  file: string;
  /** Seconds since the epoch, on the same clock as Date.now(). */
  t: number;
}

export async function startCapture(page: Page, dir: string) {
  mkdirSync(dir, { recursive: true });
  const client: CDPSession = await page.context().newCDPSession(page);
  const frames: Frame[] = [];
  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 });
    void client.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1,
  });
  return {
    frames,
    async stop() {
      await client.send('Page.stopScreencast').catch(() => undefined);
      await client.detach().catch(() => undefined);
    },
  };
}
