// KAN-10: Product Code and Product Family in the product page header (c-product-image-hero).
const { test, expect } = require("@playwright/test");
const sf = require("../../lib/salesforce");
const { soql } = require("../../lib/org");
const { uniqueName } = require("../../lib/test-data");
const { ProductHero } = require("../../pages/product-hero");

const APP = "Boarding Automation";
const DASH = "\u2014";

async function newProduct(page, { name, code, pickFamily }) {
  await sf.openApp(page, APP);
  await sf.clickNavItem(page, "Products");
  await expect(page).toHaveURL(/\/lightning\/o\/Product2\/(list|home)/);
  const rt = await sf.clickNew(page);
  if (rt) await rt.getByRole("button", { name: "Next", exact: true }).click();
  await sf.fillField(page, "Product Name", name);
  let family = null;
  if (code) await sf.fillField(page, "Product Code", code);
  if (pickFamily) {
    const combo = page.getByRole("combobox", { name: "Product Family" });
    await combo.click();
    const options = page.getByRole("option");
    await options
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => {});
    const labels = (await options.allInnerTexts())
      .map((t) => t.trim())
      .filter((t) => t && !/^--\s*none\s*--$/i.test(t));
    if (labels.length) {
      family = labels[0];
      await page.getByRole("option", { name: family, exact: true }).click();
    } else {
      await page.keyboard.press("Escape");
    }
  }
  // Not sf.saveRecord(): its waitForURL can miss a client-side navigation that already happened.
  await page.locator('button[name="SaveEdit"]').click();
  await expect(page).toHaveURL(
    /\/lightning\/r\/Product2\/[a-zA-Z0-9]{15,18}\/view/,
    { timeout: 60_000 }
  );
  const id = page.url().match(/\/r\/Product2\/([a-zA-Z0-9]{15,18})\/view/)[1];
  return { id, family };
}

test.describe.serial("Product page header fields (KAN-10)", () => {
  let id, code, family;

  test("TC-18 Header shows Product Code and Product Family, no brand line (KAN-10)", async ({
    page
  }) => {
    const unique = uniqueName("Product");
    code = uniqueName("CODE");
    const created = await newProduct(page, {
      name: unique,
      code,
      pickFamily: true
    });
    id = created.id;
    family = created.family;
    const hero = new ProductHero(page);
    await expect(hero.name()).toHaveText(unique);
    await expect(hero.label("Product Code")).toBeVisible();
    await expect(hero.label("Product Family")).toBeVisible();
    await expect(hero.code()).toHaveText(code);
    await expect(hero.family()).toHaveText(family || DASH);
    await expect(hero.brand()).toHaveCount(0);

    const [p] = soql(
      `SELECT ProductCode, Family FROM Product2 WHERE Id = '${id}'`
    );
    expect(p.ProductCode).toBe(code);
    if (family) expect(p.Family).toBeTruthy();
    else expect(p.Family).toBeNull();
  });

  test("TC-19 Editing Product Code updates the header without reload (KAN-10)", async ({
    page
  }) => {
    // The Product page uses the custom hero instead of the standard highlights panel, so openRecord() does not apply.
    await page.goto(`${sf.baseUrl()}/lightning/r/Product2/${id}/view`);
    await sf.waitForLightning(page);
    const hero = new ProductHero(page);
    await expect(hero.root).toBeVisible({ timeout: 60_000 });
    await expect(hero.code()).toHaveText(code);
    const edit = hero.editButton();
    await expect(edit).toBeVisible();
    const newCode = uniqueName("CODE") + "-2";
    await edit.click();
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.locator('button[name="SaveEdit"]') });
    await expect(dialog).toBeVisible();
    await sf.fillField(page, "Product Code", newCode);
    await dialog.locator('button[name="SaveEdit"]').click();
    await expect(dialog).toBeHidden();
    await expect(hero.code()).toHaveText(newCode);

    const [p] = soql(`SELECT ProductCode FROM Product2 WHERE Id = '${id}'`);
    expect(p.ProductCode).toBe(newCode);
  });

  test("TC-20 Empty Product Code and Family show an em dash (KAN-10)", async ({
    page
  }) => {
    const name = uniqueName("Product") + "-empty";
    const created = await newProduct(page, { name });
    const hero = new ProductHero(page);
    await expect(hero.name()).toHaveText(name);
    await expect(hero.code()).toHaveText(DASH);
    await expect(hero.family()).toHaveText(DASH);

    const [p] = soql(
      `SELECT ProductCode, Family FROM Product2 WHERE Id = '${created.id}'`
    );
    expect(p.ProductCode).toBeNull();
    expect(p.Family).toBeNull();
  });
});
