import { expect, test } from '@playwright/test';

test('Roboterseite: Regler bewegt den simulierten SO-101', async ({ page }) => {
  await page.goto('/robot');
  await expect(page.getByRole('img', { name: 'SO-101 Roboterarm in 3D' })).toBeVisible();
  const readout = page.getByText(/Greiferspitze: x/);
  await expect(readout).toContainText('z 11.');
  // Ellbogen strecken: Soll 0°, der Servo regelt dorthin, die Spitze steigt.
  await page.getByRole('slider', { name: 'Ellbogen' }).fill('0');
  await expect(page.locator('.joint-values').nth(2)).toContainText('Ist 0°');
  await expect(readout).not.toContainText('z 11.');
});

test('Spielwiese: lab.arm3d zeigt den Arm in 3D', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Roboter 3D' }).click();
  await expect(page.locator('.status')).toHaveCount(0, { timeout: 90_000 });
  await page.getByRole('button', { name: /Ausführen/ }).click();
  await expect(page.getByRole('log', { name: 'Terminal' })).toContainText('erreichbar: True');
  await expect(page.getByRole('img', { name: 'SO-101 fährt zum Ziel' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Zeitpunkt' })).toBeVisible();
});

test('Offline: Roboterseite funktioniert nach der ersten Nutzung ohne Netz', async ({
  page,
  context,
}) => {
  await page.goto('/robot');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await expect(page.getByText(/Greiferspitze: x/)).toContainText('z 11.');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('img', { name: 'SO-101 Roboterarm in 3D' })).toBeVisible();
  await expect(page.getByText(/Greiferspitze: x/)).toContainText('z 11.');
});
