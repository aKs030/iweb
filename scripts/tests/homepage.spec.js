import { test, expect } from "@playwright/test";

test("homepage loads and displays key elements", async ({ page }) => {
  await page.goto("http://127.0.0.1:8081");

  // Prüfe den Titel
  await expect(page).toHaveTitle(/Abdulkerim/);

  // Warte auf das Laden der Hauptinhalte
  await page.waitForSelector("#navigation", { timeout: 5000 });

  // Prüfe, ob die Hauptnavigation vorhanden ist
  await expect(page.locator("#navigation")).toBeVisible();

  // Prüfe, ob der Hauptinhalt geladen ist
  await expect(page.locator("#main-content")).toBeVisible();

  // Prüfe auf Vorhandensein eines bestimmten Textes (z.B. "Abdulkerim")
  await expect(page.locator("body")).toContainText("Abdulkerim");

  // Prüfe, ob keine JavaScript-Fehler aufgetreten sind (indirekt durch erfolgreiches Laden)
  const errors = [];
  page.on("pageerror", (error) => errors.push(error));
  expect(errors).toHaveLength(0);
});

test("navigation to gallery page works", async ({ page }) => {
  await page.goto("http://127.0.0.1:8081");

  // Klicke auf den Gallery-Link (angenommen, er hat href="/gallery/")
  await page.click('a[href="/gallery/"]');

  // Prüfe, ob die URL korrekt ist
  await expect(page).toHaveURL("http://127.0.0.1:8081/gallery/");

  // Prüfe den Titel der Gallery-Seite
  await expect(page).toHaveTitle(/Fotografie Portfolio/);

  // Prüfe, ob der Hauptinhalt der Gallery-Seite geladen ist
  await expect(page.locator("main")).toBeVisible();
});
