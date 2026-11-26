---
paths:
  - "force-app/**/ProductImage*"
  - "force-app/**/productImage*"
  - "force-app/**/Product_Image*"
  - "force-app/**/Product_Record_Page*"
  - "force-app/**/objects/Product2/**"
---

# Product Catalog module (prefix: ProductImage / productImage / Product_Image)

Product record page with product images (KAN-9). Not the Product _integration_ (rules/integrations/product.md).

## Entry points

- FlexiPage `Product_Record_Page` (template `recordHomeSingleColTemplateDesktop`): header = LWC `productImageHero`;
  main = tabs **Details** (`force:detailPanel`), **Product Image** (LWC `productImageUploader`), **Related**.
  Active as the **app default in Boarding Automation** (`actionOverrides` in `applications/Boarding_Automation`, View,
  Large). Other apps keep the standard page unless an admin activates it as org default.
- `productImageHero`: `getRecord` (Name; optional ProductCode, Family, Description, image field) + cacheable
  `ProductImageController.getProductHero` (image files newest first, max 10; Standard Price Book price). Under the price:
  labelled rows **Product Code** and **Product Family** (KAN-10; empty → "—", row hidden when the field is not readable —
  detected by the optional field missing from the getRecord result). No brand line above the name any more. When `Product_Image_Version_Id__c` changes it calls `refreshApex` (how a new upload appears).
  Images load from `/sfc/servlet.shepherd/version/download/<ContentVersionId>`.
- `productImageUploader`: `lightning-file-upload` (png/jpg/jpeg/gif/webp, multiple) links files to the Product, then
  `ProductImageController.setProductImage(productId, last file's documentId)` → `notifyRecordUpdateAvailable`.

## Key objects

- `Product2.Product_Image_Version_Id__c` (Text 18): ContentVersion Id of the current image. Not on the layout.
- Images are Salesforce Files (ContentDocumentLink to the Product). Never deleted by the feature.
- `ProductImageService` (with sharing, USER_MODE): `getHero`, `setImage` (file must be linked to the product and be an
  image → else `ValidationException`; `update as user`). Price is skipped when the user can't read PricebookEntry.
- Permission sets: **Product_Image_Manager** (uploaders: Product2 Read/Edit, field edit, Pricebook2 read, class, app,
  tab; assigned manually). **Onboarding_Manager** sees the page read-only (field read, Pricebook2 read, class).
  Both grant read on Product2.ProductCode and Product2.Family (KAN-10).

## Known limitations

- Rating, reviews, MRP / % off and Specifications / Reviews tabs from the KAN-9 mock-up are not built (no data).
- A non-image file uploaded through the API stays attached; it is only rejected as the product image.
- Price = Standard Price Book only.

## Tests

`ProductImageControllerTest` (developer runs it). E2E (if chosen): `specs/product/product-image.e2e.js`, TC-14..17.
