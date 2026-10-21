import { expect, test, type Page } from '@playwright/test';

async function waitForPython(page: Page) {
  await expect(page.locator('.status')).toHaveCount(0, { timeout: 90_000 });
}

test('Lernpfad zeigt Module und den nächsten Schritt', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'RoboPy' })).toBeVisible();
  await expect(page.locator('.module-card').first()).toContainText('Start');
  await expect(page.getByText('Lektion starten')).toBeVisible();
});

test('Spielwiese führt Python aus und fragt input() im Terminal ab', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Hallo' }).click();
  await waitForPython(page);
  await page.getByRole('button', { name: /Ausführen/ }).click();
  const terminal = page.getByRole('log', { name: 'Terminal' });
  await expect(terminal).toContainText('Wie heißt du?');
  await page.getByLabel('Eingabe für input()').fill('Ada');
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(terminal).toContainText('Hallo Ada!');
});

test('Stopp beendet eine Endlosschleife und Python startet neu', async ({ page }) => {
  await page.goto('/play');
  await waitForPython(page);
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('while True:\npass');
  await page.getByRole('button', { name: /Ausführen/ }).click();
  await page.getByRole('button', { name: /Stopp/ }).click();
  await expect(page.getByRole('log', { name: 'Terminal' })).toContainText('gestoppt');
  await waitForPython(page);
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('print(6 * 7)');
  await page.getByRole('button', { name: /Ausführen/ }).click();
  await expect(page.getByRole('log', { name: 'Terminal' })).toContainText('42');
});

test('Arm-Animation wird als Canvas gezeichnet', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Roboterarm' }).click();
  await waitForPython(page);
  await page.getByRole('button', { name: /Ausführen/ }).click();
  const canvas = page.getByRole('img', { name: 'Arm fährt zur Zielstellung' });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Zeitpunkt' })).toBeVisible();
});

test('Erste Lektion lässt sich abschließen und schaltet Modul 1 frei', async ({ page }) => {
  await page.goto('/l/m00-willkommen');
  const next = page.getByRole('button', { name: /^Weiter$/ });
  await next.click();
  await next.click();
  await waitForPython(page);
  await page.getByRole('button', { name: /Ausführen/ }).click();
  await expect(page.getByRole('log', { name: 'Terminal' })).toContainText('Hallo, Roboter!');
  await next.click();
  await page.getByRole('radio', { name: '2 + 3' }).click();
  await page.getByRole('radio', { name: 'Ganz sicher' }).click();
  await page.getByRole('button', { name: 'Vorhersage prüfen' }).click();
  await expect(page.getByText('Richtig vorhergesagt.')).toBeVisible();
  await next.click();
  await page.locator('.option').first().click();
  await page.getByRole('button', { name: 'Antwort prüfen' }).click();
  await next.click();
  await next.click();
  await page.locator('.option').first().click();
  await page.getByRole('radio', { name: 'Ziemlich sicher' }).click();
  await page.getByRole('button', { name: 'Antwort prüfen' }).click();
  await page.getByRole('button', { name: 'Abschließen' }).click();
  await expect(page.getByRole('heading', { name: 'Lektion abgeschlossen' })).toBeVisible();
  await page.goto('/m/m01');
  await expect(page.locator('.lesson-item.open').first()).toContainText('Dein erstes Programm');
});

test('Offline: App und Python laufen nach einmaligem Laden ohne Netz', async ({
  page,
  context,
}) => {
  await page.goto('/play');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await page.getByRole('button', { name: 'Plot' }).click();
  await waitForPython(page);
  await page.getByRole('button', { name: /Ausführen/ }).click();
  await expect(page.getByRole('img', { name: 'Sinus und Kosinus' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Plot' }).click();
  await waitForPython(page);
  await page.getByRole('button', { name: /Ausführen/ }).click();
  await expect(page.getByRole('img', { name: 'Sinus und Kosinus' })).toBeVisible();
});
