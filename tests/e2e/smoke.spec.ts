import { test, expect } from "@playwright/test";

test("homepage loads with hero + primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /send sean your project idea/i }).first()).toBeVisible();
});

test("services overview links to a service detail", async ({ page }) => {
  await page.goto("/services");
  await page.getByRole("link", { name: /house extension design/i }).first().click();
  await expect(page).toHaveURL(/\/services\/house-extensions/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/extension/i);
});

test("a location page renders unique content", async ({ page }) => {
  await page.goto("/areas/heswall");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Heswall/);
});

test("visualiser page shows the upload zone + disclaimer", async ({ page }) => {
  await page.goto("/visualiser");
  await expect(page.getByText(/Drag a photo here/i)).toBeVisible();
  await expect(page.getByText(/not an architectural drawing/i).first()).toBeVisible();
});

test("contact form is present", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByLabel(/your name/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /send sean your project idea/i })).toBeVisible();
});
