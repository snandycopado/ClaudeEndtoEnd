/**
 * Product Catalog module (KAN-9): product images stored as Salesforce Files linked to Product2, and the data for the
 * productImageHero LWC (images, newest first, and the Standard Price Book price).
 * with sharing + USER_MODE: called only from ProductImageController on behalf of the user.
 */
public with sharing class ProductImageService {
  public static final Set<String> IMAGE_EXTENSIONS = new Set<String>{
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp'
  };
  public static final Integer MAX_IMAGES = 10;

  public class ProductImage {
    @AuraEnabled
    public Id versionId;
    @AuraEnabled
    public String title;
  }

  public class ProductHero {
    @AuraEnabled
    public List<ProductImage> images = new List<ProductImage>();
    /** Standard Price Book price; null when the product has no active standard price. */
    @AuraEnabled
    public Decimal price;
  }

  /** Image files linked to the product (newest first, at most MAX_IMAGES) and its standard price. */
  public static ProductHero getHero(Id productId) {
    ProductHero hero = new ProductHero();
    if (productId == null) {
      return hero;
    }
    for (ContentDocumentLink link : [
      SELECT ContentDocument.LatestPublishedVersionId, ContentDocument.Title
      FROM ContentDocumentLink
      WHERE
        LinkedEntityId = :productId
        AND ContentDocument.FileExtension IN :IMAGE_EXTENSIONS
      WITH USER_MODE
      ORDER BY ContentDocument.CreatedDate DESC
      LIMIT :MAX_IMAGES
    ]) {
      ProductImage image = new ProductImage();
      image.versionId = link.ContentDocument.LatestPublishedVersionId;
      image.title = link.ContentDocument.Title;
      hero.images.add(image);
    }
    // Users without price book access still see the images; the price is simply not shown.
    if (!Schema.SObjectType.PricebookEntry.isAccessible()) {
      return hero;
    }
    List<PricebookEntry> entries = [
      SELECT UnitPrice
      FROM PricebookEntry
      WHERE
        Product2Id = :productId
        AND Pricebook2.IsStandard = TRUE
        AND IsActive = TRUE
      WITH USER_MODE
      LIMIT 1
    ];
    if (!entries.isEmpty()) {
      hero.price = entries[0].UnitPrice;
    }
    return hero;
  }

  /**
   * Makes an uploaded file the product's current image. The file must be linked to the product and be an image.
   * Returns the ContentVersion Id stored in Product2.Product_Image_Version_Id__c.
   */
  public static Id setImage(Id productId, Id contentDocumentId) {
    if (productId == null || contentDocumentId == null) {
      throw new ValidationException('Choose a product and an image file.');
    }
    List<ContentDocumentLink> links = [
      SELECT
        ContentDocument.FileExtension,
        ContentDocument.LatestPublishedVersionId
      FROM ContentDocumentLink
      WHERE
        LinkedEntityId = :productId
        AND ContentDocumentId = :contentDocumentId
      WITH USER_MODE
      LIMIT 1
    ];
    if (links.isEmpty()) {
      throw new ValidationException(
        'The file is not attached to this product.'
      );
    }
    String extension = links[0].ContentDocument.FileExtension;
    if (
      extension == null || !IMAGE_EXTENSIONS.contains(extension.toLowerCase())
    ) {
      throw new ValidationException(
        'Only image files (PNG, JPG, JPEG, GIF, WEBP) can be used as the product image.'
      );
    }
    Id versionId = links[0].ContentDocument.LatestPublishedVersionId;
    // Fresh sObject: update only the image field, in user mode (needs Product Edit + field FLS).
    update as user new Product2(
      Id = productId,
      Product_Image_Version_Id__c = versionId
    );
    return versionId;
  }
}
