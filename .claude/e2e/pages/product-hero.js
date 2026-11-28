// Page object for the c-product-image-hero header on the Product record page (KAN-10).
class ProductHero {
  constructor(page) {
    this.page = page;
    this.root = page.locator("c-product-image-hero:visible").first();
  }
  name() {
    return this.root.locator("h1");
  }
  editButton() {
    return this.root.locator('lightning-button[data-id="edit-product"] button');
  }
  brand() {
    return this.root.locator(".brand");
  }
  details() {
    return this.root.locator("dl.product-details");
  }
  label(text) {
    return this.details().locator("dt", { hasText: text });
  }
  code() {
    return this.details().locator('dd[data-field="ProductCode"]');
  }
  frame() {
    return this.root.locator('[data-id="image-frame"]');
  }
  ribbon() {
    return this.root.locator('[data-id="inactive-ribbon"]');
  }
  assistive() {
    return this.root.locator(
      'span[data-id="inactive-assistive"][role="status"]'
    );
  }
  family() {
    return this.details().locator('dd[data-field="Family"]');
  }
}
module.exports = { ProductHero };
