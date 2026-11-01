// Hidden developer toolbar (SDD 7.1, MVP builds only): scenario sets, forced errors, the set-up of
// the five README demo flows, and the reset of the demo data.
import { expect, test, type Page } from '@playwright/test';
import { clientNav, expectHeading, login, stubTiles } from './helpers';

test.beforeEach(async ({ page }) => stubTiles(page));

const toolbar = (page: Page) => page.getByRole('dialog', { name: 'Developer tools' });

async function openToolbar(page: Page) {
  await page.keyboard.press('Control+Alt+KeyD');
  await expect(toolbar(page)).toBeVisible();
}

async function closeToolbar(page: Page) {
  await page.keyboard.press('Escape');
  await expect(toolbar(page)).toBeHidden();
}

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();

test('is hidden until Ctrl+Alt+D or ?dev opens it', async ({ page }) => {
  await login(page, 'sara.m');
  await expectHeading(page, 'Network overview');
  await expect(toolbar(page)).toHaveCount(0);
  await openToolbar(page);
  await page.keyboard.press('Control+Alt+KeyD');
  await expect(toolbar(page)).toBeHidden();
  await clientNav(page, '/network?dev');
  await expect(toolbar(page)).toBeVisible();
});

test('SC-03: with no drivers, Generate plan explains that no plan can be made', async ({
  page,
}) => {
  await login(page, 'sara.m');
  await openToolbar(page);
  await toolbar(page)
    .getByRole('radio', { name: /Critical resource missing/ })
    .click();
  await expect(toolbar(page).getByRole('radio', { name: /Critical resource/ })).toBeChecked();
  await closeToolbar(page);
  await expect(page.getByRole('banner')).toContainText('Dev: SC-03');
  await nav(page, 'Delivery plan');
  await page.getByRole('button', { name: 'Generate plan' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'No plan can be made: no drivers for 03 Nov 2026.',
  );
});

test('no resources uploaded, then no decisions yet, then back to the normal day', async ({
  page,
}) => {
  await login(page, 'karim.b');
  await expectHeading(page, 'Resources');
  await openToolbar(page);
  await toolbar(page)
    .getByRole('radio', { name: /No resources uploaded/ })
    .click();
  await closeToolbar(page);
  await expect(page.getByText('No resources uploaded for this day')).toBeVisible();

  await openToolbar(page);
  await toolbar(page)
    .getByRole('radio', { name: /No decisions yet/ })
    .click();
  await closeToolbar(page);
  await nav(page, 'Decision history');
  await expect(page.getByText('No decisions recorded yet.')).toBeVisible();

  await openToolbar(page);
  await toolbar(page)
    .getByRole('radio', { name: /Normal day/ })
    .click();
  await closeToolbar(page);
  await expect(page.getByRole('banner')).not.toContainText('Dev:');
  await expect(page.getByRole('region', { name: 'Decisions' }).locator('tbody tr')).toHaveCount(20);
});

test('forced errors show each error state (ERR-PLAN-01, ERR-SYS-01, ERR-VAL-04)', async ({
  page,
}) => {
  await login(page, 'sara.m');
  await openToolbar(page);
  await toolbar(page).getByRole('switch', { name: 'Force ERR-PLAN-01' }).click();
  await closeToolbar(page);
  await expect(page.getByRole('banner')).toContainText('Dev: ERR-PLAN-01');
  await nav(page, 'Delivery plan');
  await page.getByRole('button', { name: 'Generate plan' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'No plan can be made: no drivers for 03 Nov 2026.',
  );

  await openToolbar(page);
  await toolbar(page).getByRole('switch', { name: 'Force ERR-PLAN-01' }).click();
  await toolbar(page).getByRole('switch', { name: 'Force ERR-SYS-01' }).click();
  await closeToolbar(page);
  await page.getByRole('button', { name: 'Generate plan' }).click();
  await page.getByRole('button', { name: 'Move Westside Terminal (ST012) down' }).click();
  await expect(
    page.getByText("The change couldn't be calculated and was undone. Please try again."),
  ).toBeVisible();

  await openToolbar(page);
  await toolbar(page).getByRole('switch', { name: 'Force ERR-SYS-01' }).click();
  await toolbar(page).getByRole('switch', { name: 'Force ERR-VAL-04' }).click();
  await closeToolbar(page);
  await page.getByRole('link', { name: 'Go to approvals' }).click();
  await page
    .getByRole('listitem', { name: /\(ST012\)$/ })
    .getByRole('button', { name: 'Approve ST012' })
    .click();
  await expect(
    page.getByText(
      'The plan for 03 Nov 2026 is already decided. This data can no longer be changed.',
    ),
  ).toBeVisible();
});

test('demo set-up buttons prepare each scene as sara.m with a fresh plan', async ({ page }) => {
  // Starts as the dispatcher: the set-up signs in as the manager by itself.
  await login(page, 'karim.b');
  await expectHeading(page, 'Resources');

  await openToolbar(page);
  await toolbar(page).getByRole('button', { name: 'Set up demo 2: Reorder on T-03' }).click();
  await expect(toolbar(page)).toBeHidden();
  await expectHeading(page, 'Delivery planner');
  await expect(page.getByRole('banner')).toContainText('Sara M.');
  await expect(page.getByRole('button', { name: /La Marsa Corniche · ST003/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  // Demo 3 after demo 2: the plan is the untouched recommended plan again (scripted outcome).
  await openToolbar(page);
  await toolbar(page).getByRole('button', { name: 'Set up demo 3: Reorder on T-01' }).click();
  await expect(page.getByRole('button', { name: /Westside Terminal · ST012/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: 'Move Westside Terminal (ST012) down' }).click();
  await expect(page.getByRole('region', { name: 'Impact of your changes' })).toContainText(
    'No risk: this change keeps all deliveries on time and within limits.',
  );

  await openToolbar(page);
  await toolbar(page).getByRole('button', { name: 'Set up demo 5: Reject ST014' }).click();
  await expectHeading(page, 'Review and approve');
  await expect(page.getByRole('button', { name: 'Reject ST014' })).toBeVisible();
});

test('every demo set-up button opens its scene', async ({ page }) => {
  await login(page, 'sara.m');
  const scenes = [
    {
      n: 1,
      title: 'Move ST012 to T-02',
      heading: 'Delivery planner',
      stop: 'Westside Terminal · ST012',
    },
    {
      n: 4,
      title: 'Quantity above the limit',
      heading: 'Delivery planner',
      stop: 'Westside Terminal · ST012',
    },
  ];
  for (const s of scenes) {
    await openToolbar(page);
    await toolbar(page)
      .getByRole('button', { name: `Set up demo ${s.n}: ${s.title}` })
      .click();
    await expectHeading(page, s.heading);
    await expect(page.getByRole('button', { name: new RegExp(s.stop) })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  }
});

test('Reset demo data asks first, then restores the sample data', async ({ page }) => {
  await login(page, 'nadia.a');
  await page.getByRole('button', { name: 'Deactivate Karim B.' }).click();
  await page
    .getByRole('dialog', { name: 'Deactivate Karim B.?' })
    .getByRole('button', { name: 'Deactivate' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Users' }).getByRole('row').filter({ hasText: 'Karim B.' }),
  ).toContainText('Inactive');

  await openToolbar(page);
  await toolbar(page).getByRole('button', { name: 'Reset demo data' }).click();
  const confirm = page.getByRole('dialog', { name: 'Reset the demo data?' });
  await confirm.getByRole('button', { name: 'Reset' }).click();
  await expect(toolbar(page)).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole('region', { name: 'Users' }).getByRole('row').filter({ hasText: 'Karim B.' }),
  ).toContainText('Active');
});
