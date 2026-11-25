/**
 * Apex controller for the productImageHero and productImageUploader LWCs on the Product record page (KAN-9).
 * getProductHero is cacheable (read-only transaction, no DML): AppLogger.save() cannot store a log there, so its
 * errors are not logged; they are returned to the LWC, which shows them. setProductImage logs unexpected errors.
 */
public with sharing class ProductImageController {
  private static final String CLASS_NAME = 'ProductImageController';

  @AuraEnabled(cacheable=true)
  public static ProductImageService.ProductHero getProductHero(Id productId) {
    try {
      return ProductImageService.getHero(productId);
    } catch (Exception ex) {
      throw toAuraException(ex, null, productId);
    }
  }

  @AuraEnabled
  public static String setProductImage(Id productId, Id contentDocumentId) {
    try {
      return ProductImageService.setImage(productId, contentDocumentId);
    } catch (Exception ex) {
      throw toAuraException(ex, 'setProductImage', productId);
    }
  }

  /**
   * Validation messages go to the user as-is; anything unexpected is logged first (method = null: no logging,
   * used by the cacheable read). A missing edit permission gets a message the user can act on.
   */
  private static AuraHandledException toAuraException(
    Exception ex,
    String method,
    Id recordId
  ) {
    String message = ex.getMessage();
    if (!(ex instanceof ValidationException)) {
      if (method != null) {
        AppLogger.error(ex, CLASS_NAME, method, recordId);
        AppLogger.save();
      }
      message = ex instanceof DmlException &&
        ex.getMessage().contains('INSUFFICIENT_ACCESS')
        ? 'You do not have access to change this product\'s image. Ask an admin for the Product Image Manager permission set.'
        : 'Something went wrong: ' + message;
    }
    AuraHandledException auraEx = new AuraHandledException(message);
    auraEx.setMessage(message);
    return auraEx;
  }
}
