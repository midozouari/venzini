// The "Actions" of docs/demo-script.md, as the robot performs them, one function per scene.
// Where the real UI differs from the written action, the adaptation is noted (see the README of
// this folder). The developer toolbar is never opened: each flow keeps its own state, and scene 11
// starts from a fresh session (a reload on the login page, which looks the same on screen).
import { expect, type Page } from '@playwright/test';
import { sleep, type Human } from './human';

export interface Ctx {
  page: Page;
  h: Human;
  /** Shows the scene's on-screen title again (after a reload removed it). */
  showTitle: (ms: number) => Promise<void>;
}

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });
const card = (page: Page, tanker: string, route: string) =>
  page.getByRole('listitem', { name: `${tanker}, route ${route}` });
const impact = (page: Page) => page.getByRole('region', { name: 'Impact of your changes' });

/** Waits until the map card shows its tiles, so the video never shows a half-drawn map. */
async function mapReady(page: Page) {
  await page
    .waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length >= 8, null, {
      timeout: 20_000,
    })
    .catch(() => undefined); // a slow tile server must not stop the video
  await sleep(600);
}

async function logIn({ page, h }: Ctx, login: string) {
  await h.click(page.getByLabel('Login'), { pause: 300 });
  await h.type(login);
  await h.click(page.getByLabel('Password', { exact: true }), { pause: 300 });
  await h.type('venzini-demo');
  await h.click(page.getByRole('button', { name: 'Log in' }));
}

async function logOut({ page, h }: Ctx) {
  await h.click(page.getByRole('button', { name: 'Log out' }));
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
}

/** Opens the station picker, searches, and picks the station. */
async function pickStation({ page, h }: Ctx, search: string, option: RegExp) {
  await h.click(page.getByRole('button', { name: /^Station:/ }), { pause: 500 });
  await h.type(search);
  await h.click(page.getByRole('option', { name: option }));
}

/** The middle of one route leg on the map, in page coordinates. */
async function legPoint(page: Page) {
  return page.evaluate(() => {
    const paths = [...document.querySelectorAll<SVGPathElement>('path.leaflet-interactive')];
    const leg = paths
      .map((p) => ({ p, len: p.getTotalLength() }))
      .filter(({ len }) => len > 120)
      .sort((a, b) => b.len - a.len)[0];
    if (!leg) return null;
    const pt = leg.p.getPointAtLength(leg.len / 2);
    const m = leg.p.getScreenCTM();
    return m ? { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f } : null;
  });
}

async function resetToOptimal({ page, h }: Ctx) {
  await h.click(page.getByRole('button', { name: 'Reset to optimal' }));
  const dialog = page.getByRole('dialog', { name: 'Reset to the optimal plan?' });
  await h.click(dialog.getByRole('button', { name: 'Reset to optimal' }));
  await expect(impact(page)).toContainText('Optimal plan, no changes');
}

export const SCENES: Record<number, { name: string; run: (ctx: Ctx) => Promise<void> }> = {
  1: {
    name: 'Introduction',
    // The login page is already open (main.ts loads it before the recording starts).
    async run() {
      await sleep(3000);
    },
  },

  2: {
    name: 'Logging in as the operations manager',
    async run(ctx) {
      await logIn(ctx, 'sara.m');
      await expect(
        ctx.page.getByRole('heading', { level: 1, name: 'Network overview' }),
      ).toBeVisible();
      await mapReady(ctx.page);
    },
  },

  3: {
    name: 'Network overview',
    async run({ page, h }) {
      await sleep(2000);
      await h.sweep(page.getByRole('region', { name: 'Network map' }), [
        [0.3, 0.3],
        [0.55, 0.45],
        [0.45, 0.7],
      ]);
      const kpis = page.getByRole('region', { name: 'Key figures' });
      await h.sweep(
        kpis,
        [
          [0.1, 0.5],
          [0.37, 0.5],
          [0.63, 0.5],
          [0.88, 0.5],
        ],
        650,
      );
      await h.hover(page.getByRole('heading', { name: 'Stations at highest risk' }), 900);
      const harbor = page
        .getByRole('list', { name: 'Stockout alerts' })
        .getByRole('button')
        .first();
      await expect(harbor).toContainText('Harbor Road');
      await h.click(harbor);
      await sleep(3000);
      await h.press('Escape');
    },
  },

  4: {
    name: 'Station forecast and its explanation',
    async run(ctx) {
      const { page, h } = ctx;
      await h.click(nav(page, 'Forecasts'));
      await pickStation(ctx, 'ST014', /ST014/);
      await h.click(page.getByRole('radio', { name: 'Diesel' }));
      const chart = page.getByRole('img', { name: /7-day forecast, Harbor Road, Diesel/ });
      await h.sweep(
        chart,
        [
          [0.58, 0.5],
          [0.66, 0.5],
          [0.74, 0.5],
          [0.82, 0.5],
        ],
        900,
      );
      await h.hover(page.getByRole('heading', { name: 'What drives this forecast' }), 1500);
      await h.hover(page.getByText('Uncertain forecast').first(), 2000);
      await h.click(page.getByRole('button', { name: /Show as table/ }).first());
      await sleep(2000);
      await h.click(page.getByRole('button', { name: /Show as chart/ }).first());
    },
  },

  5: {
    name: 'Short sales history and network totals',
    async run(ctx) {
      const { page, h } = ctx;
      await pickStation(ctx, 'ST020', /ST020/);
      await h.click(page.getByRole('radio', { name: 'Petrol 95' }));
      await h.hover(page.getByText('Similar-stations baseline').first(), 2000);
      await h.click(page.getByRole('link', { name: 'Totals' }));
      await h.click(page.getByRole('radio', { name: 'By warehouse' }));
      await sleep(2000);
    },
  },

  6: {
    name: 'Generating the delivery plan',
    async run({ page, h }) {
      await h.click(nav(page, 'Delivery plan'));
      const generate = page.getByRole('button', { name: 'Generate plan' });
      if (await generate.isVisible().catch(() => false)) await h.click(generate);
      await expect(page.getByRole('region', { name: 'Routes' })).toBeVisible();
      await mapReady(page);
      await h.sweep(page.getByRole('region', { name: 'Route map' }), [
        [0.3, 0.35],
        [0.6, 0.5],
        [0.45, 0.7],
      ]);
      for (const [t, r] of [
        ['T-01', 'R-01'],
        ['T-02', 'R-02'],
        ['T-03', 'R-03'],
      ] as const)
        await h.hover(card(page, t, r), 800, { at: [0.5, 0.15] });
      const leg = await legPoint(page);
      if (leg) {
        await h.moveTo(leg.x, leg.y, { speed: 0.7 });
        await sleep(2200);
      }
      const unserved = page.getByRole('region', { name: 'Not served today' });
      await unserved.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await sleep(900);
      await h.hover(unserved.getByText(/ST019/).first(), 3000);
    },
  },

  7: {
    name: 'Editing a route and seeing the risk live',
    async run(ctx) {
      const { page, h } = ctx;
      const handle = page.getByRole('button', {
        name: 'Drag Westside Terminal (ST012) to reorder or move it',
      });
      await h.drag(handle, card(page, 'T-02', 'R-02'));
      const banner = page.getByRole('alert').filter({ hasText: 'Approval is blocked.' });
      if (!(await banner.isVisible().catch(() => false))) {
        // Fallback named in the script: the "Move to tanker…" button.
        await h.click(
          page.getByRole('button', { name: 'Move Westside Terminal (ST012) to another tanker' }),
        );
        await h.click(page.getByRole('dialog').getByRole('button', { name: 'Move to T-02' }));
      }
      await expect(banner).toBeVisible();
      await h.hover(impact(page), 2500);
      await h.hover(banner, 3000);
      await resetToOptimal(ctx);
    },
  },

  8: {
    name: 'A safe change and the quantity limit',
    async run(ctx) {
      const { page, h } = ctx;
      await h.click(page.getByRole('button', { name: 'Move Westside Terminal (ST012) down' }));
      await expect(impact(page)).toContainText('No risk');
      await h.hover(impact(page).getByText(/No risk/), 2000);
      // Adapted: the plan goes back to optimal first, so the scripted limit (6,400 L) applies.
      await resetToOptimal(ctx);
      await h.click(page.getByRole('button', { name: /Westside Terminal · ST012/ }));
      await h.click(page.getByRole('button', { name: 'Edit quantity of Petrol 95 for ST012' }));
      const dialog = page.getByRole('dialog', { name: 'Petrol 95 for ST012' });
      const litres = dialog.getByLabel('Litres');
      await h.click(litres, { pause: 300 });
      await page.keyboard.press('Control+A');
      await h.type('9000');
      await expect(dialog.getByRole('alert')).toBeVisible();
      await h.hover(dialog.getByRole('alert'), 3000);
      // Adapted: the dialog's close button is "Back" (the script says "Cancel").
      await h.click(dialog.getByRole('button', { name: 'Back' }));
    },
  },

  9: {
    name: 'Approving and rejecting recommendations',
    async run({ page, h }) {
      await h.click(nav(page, 'Approvals'));
      await expect(page.getByText('Recommendations require manager approval')).toBeVisible();
      await h.sweep(
        page.locator('main'),
        [
          [0.3, 0.3],
          [0.35, 0.5],
          [0.3, 0.7],
        ],
        700,
      );
      const row = page.getByRole('listitem', { name: /\(ST014\)$/ });
      await h.click(row.getByRole('button', { name: 'Reject ST014' }));
      const dialog = page.getByRole('dialog', { name: /^Reject ST014/ });
      await h.click(dialog.getByLabel('Note (optional)'), { pause: 300 });
      await h.type('Customer closed for maintenance');
      await h.click(dialog.getByRole('button', { name: 'Reject ST014' }));
      const summary = page.getByRole('status').filter({ hasText: 'not dispatched' });
      await expect(summary).toBeVisible();
      await h.hover(summary, 3000);
      await h.click(page.getByRole('button', { name: 'Approve all' }));
      await h.click(page.getByRole('dialog').getByRole('button', { name: 'Approve all' }));
      await expect(page.getByText(/Plan for 03 Nov 2026 decided/).first()).toBeVisible();
      await sleep(1500);
    },
  },

  10: {
    name: 'Decision history',
    async run({ page, h }) {
      await h.click(nav(page, 'Decision history'));
      const rows = page.getByRole('region', { name: 'Decisions' });
      await h.click(rows.getByRole('link').first());
      const panel = page.getByRole('dialog');
      await expect(panel).toContainText('Original recommendation and final version');
      await h.hover(
        panel.getByRole('heading', { name: 'Original recommendation and final version' }),
        1200,
      );
      await h.sweep(
        panel.getByRole('table'),
        [
          [0.45, 0.4],
          [0.8, 0.4],
          [0.8, 0.8],
        ],
        700,
      );
      await h.hover(panel.getByRole('heading', { name: 'Cost' }), 1800);
      await h.press('Escape');
    },
  },

  11: {
    name: "The dispatcher's day",
    async run(ctx) {
      const { page, h } = ctx;
      await logOut(ctx);
      // Adapted: a fresh session. After scene 9 the resources of 03 Nov are locked, so the page
      // reloads here (the login page looks the same) to start again from the sample data.
      await page.reload();
      await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
      await h.place(h.position.x, h.position.y);
      await ctx.showTitle(2200);
      await logIn(ctx, 'karim.b');
      await expect(page.getByRole('region', { name: 'Tankers' })).toBeVisible();
      await h.click(page.getByRole('switch', { name: 'T-06 available' }));
      await h.hover(page.getByText(/Tanker T-06 has not returned from trip R-11/).first(), 2000);
      await h.click(page.getByRole('button', { name: 'Save resources' }));
      const dialog = page.getByRole('dialog', { name: /^Save the resources/ });
      await expect(dialog).toBeVisible();
      await h.hover(dialog.getByText('T-06').first(), 2200);
      // Adapted: the dialog's cancel button is "Keep editing"; T-06 is then switched back off so
      // no unsaved change is left when the day changes.
      await h.click(dialog.getByRole('button', { name: 'Keep editing' }));
      await h.click(page.getByRole('switch', { name: 'T-06 available' }));
      await h.click(page.getByRole('button', { name: 'Previous day' }), { pause: 700 });
      await h.click(page.getByRole('button', { name: 'Previous day' }));
      await expect(page.getByRole('banner')).toContainText('Sun 01 Nov 2026');
      await h.click(
        page
          .getByRole('navigation', { name: 'Resources views' })
          .getByRole('link', { name: /Trips/ }),
      );
      const trip = page.getByRole('listitem').filter({ hasText: 'R-09 · T-03' });
      await h.click(trip.getByRole('button', { name: 'Record departure' }));
      const record = page.getByRole('dialog', { name: 'Record the departure of R-09' });
      await h.hover(record.getByLabel('Time'), 900);
      await h.click(record.getByRole('button', { name: 'Record departure' }));
      await expect(trip).toContainText('Departed');
      await sleep(1200);
    },
  },

  12: {
    name: 'Administration',
    async run(ctx) {
      const { page, h } = ctx;
      await logOut(ctx);
      await logIn(ctx, 'nadia.a');
      await expect(page.getByRole('region', { name: 'Users' })).toBeVisible();
      await sleep(2000);
      await h.click(
        page
          .getByRole('navigation', { name: 'Administration views' })
          .getByRole('link', { name: 'Stations' }),
      );
      await expect(page.getByRole('region', { name: 'Stations' })).toBeVisible();
      await sleep(2000);
    },
  },

  13: {
    name: 'Closing',
    async run(ctx) {
      await logOut(ctx);
      await ctx.h.moveTo(1460, 820, { speed: 0.6 });
      await sleep(3000);
    },
  },
};
