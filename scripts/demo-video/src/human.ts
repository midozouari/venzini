// Human-like input for the recording: eased, slightly curved mouse paths, a pause after each click,
// and typing at a person's speed. The fake cursor (overlay.ts) follows these real mouse events.
import type { Locator, Page } from '@playwright/test';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deterministic jitter, so two runs of the video look the same. */
let seed = 42;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export class Human {
  private x = 1500;
  private y = 900;

  constructor(readonly page: Page) {}

  /** Puts the cursor somewhere without a visible glide (start of the video, after a reload). */
  async place(x: number, y: number) {
    this.x = x;
    this.y = y;
    await this.page.mouse.move(x, y);
  }

  /** A smooth, slightly curved glide to a point; longer distances take a little longer. */
  async moveTo(x: number, y: number, { speed = 1 }: { speed?: number } = {}) {
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    const ms = Math.min(1100, 260 + dist * 0.55) / speed;
    const steps = Math.max(8, Math.round(ms / 16));
    // A gentle bow to one side, like a wrist movement.
    const bow = Math.min(60, dist * 0.08) * (random() < 0.5 ? -1 : 1);
    const nx = -dy / dist;
    const ny = dx / dist;
    const x0 = this.x;
    const y0 = this.y;
    for (let i = 1; i <= steps; i++) {
      const t = easeInOut(i / steps);
      const arc = Math.sin(Math.PI * t) * bow;
      await this.page.mouse.move(x0 + dx * t + nx * arc, y0 + dy * t + ny * arc);
      await sleep(ms / steps);
    }
    this.x = x;
    this.y = y;
  }

  /** Glides to an element (to a point inside it, not always the exact center). */
  async moveToElement(
    target: Locator,
    { at, speed }: { at?: [number, number]; speed?: number } = {},
  ) {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`Not visible: ${target.toString()}`);
    const [fx, fy] = at ?? [0.5 + (random() - 0.5) * 0.2, 0.5 + (random() - 0.5) * 0.2];
    await this.moveTo(box.x + box.width * fx, box.y + box.height * fy, { speed });
    return box;
  }

  /** Moves to the element, clicks it, then pauses about a second like a person reading. */
  async click(target: Locator, { pause = 1000 }: { pause?: number } = {}) {
    await target.waitFor({ state: 'visible' });
    await this.moveToElement(target);
    await sleep(120 + random() * 120);
    await this.page.mouse.down();
    await sleep(70 + random() * 50);
    await this.page.mouse.up();
    await sleep(pause);
  }

  /** Types at a person's speed (about 110–190 ms per key). */
  async type(text: string) {
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await sleep(110 + random() * 80);
    }
    await sleep(400);
  }

  async press(key: string, { pause = 900 }: { pause?: number } = {}) {
    await this.page.keyboard.press(key);
    await sleep(pause);
  }

  /** Rests the cursor over an element for a while. */
  async hover(target: Locator, ms = 1200, opts: { at?: [number, number] } = {}) {
    await this.moveToElement(target, opts);
    await sleep(ms);
  }

  /** A slow sweep across an element, left to right, at a few heights. */
  async sweep(target: Locator, points: [number, number][], pauseEach = 450) {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`Not visible: ${target.toString()}`);
    for (const [fx, fy] of points) {
      await this.moveTo(box.x + box.width * fx, box.y + box.height * fy, { speed: 0.7 });
      await sleep(pauseEach);
    }
  }

  /** A person's drag: press, a small start movement, a slow carry, a short hold, release. */
  async drag(from: Locator, to: Locator, { targetY = 28 }: { targetY?: number } = {}) {
    await to.scrollIntoViewIfNeeded();
    await from.scrollIntoViewIfNeeded();
    const a = await this.moveToElement(from, { at: [0.5, 0.5] });
    await sleep(300);
    await this.page.mouse.down();
    await sleep(150);
    await this.moveTo(a.x + a.width / 2, a.y + a.height / 2 + 10, { speed: 0.6 });
    const b = await to.boundingBox();
    if (!b) throw new Error(`Not visible: ${to.toString()}`);
    await this.moveTo(b.x + b.width / 2, b.y + Math.min(b.height / 2, targetY), { speed: 0.45 });
    await sleep(450);
    await this.page.mouse.up();
    await sleep(1000);
  }

  get position() {
    return { x: this.x, y: this.y };
  }
}
