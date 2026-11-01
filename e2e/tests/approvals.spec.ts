// UI-06 Review and approve: UC-07 approve, reject with re-plan, adjust, approve all, reject all,
// blocked by overload (FR-67 to FR-71, FR-77, FR-80 to FR-82; BR-30).
import { expect, test, type Page } from '@playwright/test';
import { expectHeading, login, openPlanner, stubTiles } from './helpers';

async function openApprovals(page: Page) {
  await openPlanner(page);
  await page.getByRole('link', { name: 'Go to approvals' }).click();
  await expectHeading(page, 'Review and approve');
  await expect(page.getByText('Recommendations require manager approval')).toBeVisible();
}

const row = (page: Page, station: string) =>
  page.getByRole('listitem', { name: new RegExp(`\\(${station}\\)$`) });

test('says when there is no plan to review yet', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'sara.m');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Approvals' })
    .click();
  await expect(page.getByText('No plan to review for 03 Nov 2026')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the planner' })).toBeVisible();
});

test('demo 5: rejecting ST014 makes a new plan in which ST019 is served (FR-82)', async ({
  page,
}) => {
  await openApprovals(page);
  await expect(page.getByRole('region', { name: 'Not served today' })).toContainText('ST019');
  await row(page, 'ST014').getByRole('button', { name: 'Reject ST014' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reject ST014 Harbor Road?' });
  await expect(dialog).toContainText(
    'ST014 is high risk: rejecting it leaves it unserved on 03 Nov 2026.',
  );
  await dialog.getByLabel('Note (optional)').fill('Station closed for works');
  await dialog.getByRole('button', { name: 'Reject ST014' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'not dispatched' })).toContainText(
    'ST014 is not dispatched (high risk). A new optimal plan was made: ST019 is now served.',
  );
  await expect(row(page, 'ST019')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Not served today' })).toContainText(
    'ST014 is not served today',
  );
});

test('approves one action, then the rest with Approve all after a confirmation (FR-69, FR-80, BR-30)', async ({
  page,
}) => {
  await openApprovals(page);
  await row(page, 'ST012').getByRole('button', { name: 'Approve ST012' }).click();
  await expect(row(page, 'ST012')).toContainText('Approved');

  await page.getByRole('button', { name: 'Approve all' }).click();
  const dialog = page.getByRole('dialog', { name: 'Approve all 16 pending actions?' });
  await dialog.getByRole('button', { name: 'Approve all' }).click();
  await expect(page.getByText('Plan for 03 Nov 2026 decided: 16 actions approved.')).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('Plan decided');

  // The decided day's trips can now be recorded, and the planner is read-only.
  await page.getByRole('link', { name: 'Go to trips' }).click();
  await expect(page.getByText('Plan for 03 Nov 2026 decided: 6 trips to record.')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Delivery plan' })
    .click();
  await expect(
    page.getByText(
      'The plan for 03 Nov 2026 is already decided. This data can no longer be changed.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Drag / })).toHaveCount(0);
});

test('Reject all asks for confirmation and can be cancelled (FR-80)', async ({ page }) => {
  await openApprovals(page);
  await page.getByRole('button', { name: 'Reject all' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reject all 17 pending actions?' });
  await expect(dialog).toContainText('None of these deliveries will be dispatched on 03 Nov 2026.');
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Reject all' }).click();
  await page
    .getByRole('dialog', { name: 'Reject all 17 pending actions?' })
    .getByRole('button', { name: 'Reject all' })
    .click();
  await expect(page.getByText('Plan for 03 Nov 2026 decided: 17 actions rejected.')).toBeVisible();
});

test('an overload blocks approval and says how to fix it (FR-77, ERR-PLAN-04)', async ({
  page,
}) => {
  await openPlanner(page);
  await page
    .getByRole('button', { name: 'Move Westside Terminal (ST012) to another tanker' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Move to T-02' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Approval is blocked.' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to approvals' }).click();

  const banner = page.getByRole('alert').filter({ hasText: 'Approval is blocked.' });
  await expect(banner).toContainText(
    'Tanker T-02 is overloaded: 34,000 L on a 32,000 L tanker. Remove 2,000 L before approving.',
  );
  await expect(page.getByRole('button', { name: 'Approve all' })).toBeDisabled();
  await expect(row(page, 'ST012').getByRole('button', { name: 'Approve ST012' })).toBeDisabled();
  await expect(row(page, 'ST012')).toContainText('Approve is off: T-02 is overloaded.');
  // Actions of other tankers can still be approved.
  await expect(row(page, 'ST014').getByRole('button', { name: 'Approve ST014' })).toBeEnabled();

  await banner.getByRole('link', { name: 'Fix in the planner' }).click();
  await expectHeading(page, 'Delivery planner');
  await expect(page.getByRole('region', { name: 'Routes' })).toBeVisible();
});

test('Adjust opens the planner on the station (FR-81)', async ({ page }) => {
  await openApprovals(page);
  await row(page, 'ST005').getByRole('link', { name: 'Adjust ST005' }).click();
  await expectHeading(page, 'Delivery planner');
  await expect(
    page.getByRole('button', { name: /Borj Louzir · ST005/, expanded: true }),
  ).toBeVisible();
});
