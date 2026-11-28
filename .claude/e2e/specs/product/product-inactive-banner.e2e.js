// KAN-11: INACTIVE ribbon and greyed-out image for inactive products (c-product-image-hero).
const { test, expect } = require("@playwright/test");
const sf = require("../../lib/salesforce");
const { soql } = require("../../lib/org");
const { uniqueName } = require("../../lib/test-data");
const { ProductHero } = require("../../pages/product-hero");

const APP = "Boarding Automation";

async function openProduct(page, id) {
  await page.goto(`${sf.baseUrl()}/lightning/r/Product2/${id}/view`);
  await sf.waitForLightning(page);
  const hero = new ProductHero(page);
  await expect(hero.root).toBeVisible({ timeout: 60_000 });
  return hero;
}

async function setActiveViaEdit(page, hero, active) {
  await hero.editButton().click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.locator('button[name="SaveEdit"]') });
  await expect(dialog).toBeVisible();
  const box = dialog.getByRole("checkbox", { name: "Active" });
  await expect(box).toBeVisible();
  if (active) await box.check();
  else await box.uncheck();
  await dialog.locator('button[name="SaveEdit"]').click();
  await expect(dialog).toBeHidden();
}

test.describe.serial("Product inactive banner (KAN-11)", () => {
  let id;

  test("TC-21 Inactive product shows the INACTIVE ribbon over the placeholder (KAN-11)", async ({
    page
  }) => {
    const name = uniqueName("Product");
    await sf.openApp(page, APP);
    await sf.clickNavItem(page, "Products");
    await expect(page).toHaveURL(/\/lightning\/o\/Product2\/(list|home)/);
    const rt = await sf.clickNew(page);
    if (rt) await rt.getByRole("button", { name: "Next", exact: true }).click();
    await sf.fillField(page, "Product Name", name);
    const box = page.getByRole("checkbox", { name: "Active" });
    await expect(box).toBeVisible();
    await box.uncheck();
    await page.locator('button[name="SaveEdit"]').click();
    await expect(page).toHaveURL(
      /\/lightning\/r\/Product2\/[a-zA-Z0-9]{15,18}\/view/,
      { timeout: 60_000 }
    );
    id = page.url().match(/\/r\/Product2\/([a-zA-Z0-9]{15,18})\/view/)[1];

    const hero = new ProductHero(page);
    await expect(hero.name()).toHaveText(name);
    await expect(hero.ribbon()).toBeVisible();
    await expect(hero.ribbon()).toHaveText("INACTIVE");
    await expect(hero.frame()).toHaveClass(/image-frame_inactive/);

    const [p] = soql(`SELECT IsActive FROM Product2 WHERE Id = '${id}'`);
    expect(p.IsActive).toBe(false);
  });

  test("TC-24 Assistive status text announces the inactive state (KAN-11)", async ({
    page
  }) => {
    const hero = await openProduct(page, id);
    await expect(hero.assistive()).toHaveText("This product is inactive.");
    await expect(hero.ribbon()).toHaveAttribute("aria-hidden", "true");

    const [p] = soql(`SELECT IsActive FROM Product2 WHERE Id = '${id}'`);
    expect(p.IsActive).toBe(false);
  });

  test("TC-22 Activating the product hides the ribbon without reload (KAN-11)", async ({
    page
  }) => {
    const hero = await openProduct(page, id);
    await expect(hero.ribbon()).toBeVisible();
    await setActiveViaEdit(page, hero, true);
    await expect(hero.ribbon()).toHaveCount(0);
    await expect(hero.frame()).not.toHaveClass(/image-frame_inactive/);
    await expect(hero.assistive()).toHaveText("");

    const [p] = soql(`SELECT IsActive FROM Product2 WHERE Id = '${id}'`);
    expect(p.IsActive).toBe(true);
  });

  test("TC-23 Deactivating the product shows the ribbon again without reload (KAN-11)", async ({
    page
  }) => {
    const hero = await openProduct(page, id);
    await expect(hero.ribbon()).toHaveCount(0);
    await setActiveViaEdit(page, hero, false);
    await expect(hero.ribbon()).toBeVisible();
    await expect(hero.ribbon()).toHaveText("INACTIVE");
    await expect(hero.frame()).toHaveClass(/image-frame_inactive/);

    const [p] = soql(`SELECT IsActive FROM Product2 WHERE Id = '${id}'`);
    expect(p.IsActive).toBe(false);
  });
});
