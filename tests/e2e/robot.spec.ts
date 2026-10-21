import { expect, test } from '@playwright/test';

test('Roboterseite: Regler bewegt den simulierten SO-101', async ({ page }) => {
  await page.goto('/robot');
  await expect(page.getByRole('img', { name: 'SO-101 Roboterarm in 3D' })).toBeVisible();
  const readout = page.getByText(/Greiferspitze: x/);
  await expect(readout).toContainText('z 11.');
  await page.getByRole('tab', { name: 'Einzelne Gelenke' }).click();
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

async function toolZ(page: import('@playwright/test').Page): Promise<number> {
  const text = await page.getByText(/Greiferspitze: x/).textContent();
  return Number(/z (-?[\d.]+) cm/.exec(text ?? '')?.[1] ?? NaN);
}

test('Vorführen: der Experte löst „anheben“ und „in die Schale“', async ({ page }) => {
  await page.goto('/robot');
  await expect(page.getByText(/Greiferspitze: x/)).toContainText('z 11.');
  await page.getByRole('button', { name: 'Vorführen' }).click();
  await expect(page.getByText(/Geschafft nach/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Würfel in die Schale' }).click();
  await expect(page.getByText(/Greiferspitze: x/)).toContainText('z 11.');
  await page.getByRole('button', { name: 'Vorführen' }).click();
  await expect(page.getByText(/Geschafft nach/)).toBeVisible({ timeout: 30_000 });
});

test('Steuerkreuz und Tastatur bewegen den Greifer, Kamera zeigt Farbe und Tiefe', async ({
  page,
}) => {
  await page.goto('/robot');
  await expect(page.getByText(/Greiferspitze: x/)).toContainText('z 11.');
  const z0 = await toolZ(page);
  const up = page.getByRole('button', { name: 'Hoch', exact: true });
  await up.hover();
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(() => toolZ(page)).toBeGreaterThan(z0 + 3);
  const z1 = await toolZ(page);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.down('f');
  await page.waitForTimeout(500);
  await page.keyboard.up('f');
  await expect.poll(() => toolZ(page)).toBeLessThan(z1 - 2);
  await expect(page.getByRole('img', { name: 'Tiefenbild' })).toBeVisible();
  await expect(page.getByText(/Mitte \d+\.\d cm/)).toBeVisible();
  await page.getByRole('button', { name: 'Vorne' }).click();
  await expect(page.getByText(/Mitte \d+\.\d cm/)).toBeVisible();
});

test('Spielwiese: Python greift den Würfel mit Physik', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Greifen' }).click();
  await expect(page.locator('.status')).toHaveCount(0, { timeout: 90_000 });
  await page.getByRole('button', { name: /Ausführen/ }).click();
  await expect(
    page.getByRole('img', { name: 'Python greift den Würfel (mit Physik)' }),
  ).toBeVisible();
  await expect(
    page.getByText('Mit Physik: Die Winkel sind Sollwerte für die Servos.'),
  ).toBeVisible();
});
