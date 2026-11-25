/** Tests for ProductImageController / ProductImageService (KAN-9). Written by Claude for coverage; run by the developer. */
@IsTest
private class ProductImageControllerTest {
  private static Product2 createProduct() {
    Product2 product = new Product2(
      Name = 'Test Headphones',
      Family = 'Audio',
      IsActive = true
    );
    insert product;
    return product;
  }

  private static Id attachFile(Id productId, String fileName) {
    ContentVersion version = new ContentVersion(
      Title = fileName,
      PathOnClient = fileName,
      VersionData = Blob.valueOf('test file'),
      FirstPublishLocationId = productId
    );
    insert version;
    return [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id]
    .ContentDocumentId;
  }

  @IsTest
  static void heroWithoutImagesOrPrice() {
    Product2 product = createProduct();
    Test.startTest();
    ProductImageService.ProductHero hero = ProductImageController.getProductHero(
      product.Id
    );
    Test.stopTest();
    Assert.areEqual(0, hero.images.size(), 'No images expected');
    Assert.isNull(hero.price, 'No standard price expected');
  }

  @IsTest
  static void heroListsImagesOnlyAndPrice() {
    Product2 product = createProduct();
    attachFile(product.Id, 'front.png');
    attachFile(product.Id, 'manual.pdf');
    insert new PricebookEntry(
      Pricebook2Id = Test.getStandardPricebookId(),
      Product2Id = product.Id,
      UnitPrice = 99.50,
      IsActive = true
    );
    Test.startTest();
    ProductImageService.ProductHero hero = ProductImageController.getProductHero(
      product.Id
    );
    Test.stopTest();
    Assert.areEqual(1, hero.images.size(), 'Only the PNG is an image');
    Assert.areEqual(99.50, hero.price, 'Standard price expected');
  }

  @IsTest
  static void setProductImageStoresVersionId() {
    Product2 product = createProduct();
    Id documentId = attachFile(product.Id, 'front.png');
    Test.startTest();
    String versionId = ProductImageController.setProductImage(
      product.Id,
      documentId
    );
    Test.stopTest();
    Product2 saved = [
      SELECT Product_Image_Version_Id__c
      FROM Product2
      WHERE Id = :product.Id
      WITH SYSTEM_MODE
    ];
    Assert.areEqual(
      versionId,
      saved.Product_Image_Version_Id__c,
      'Image version Id stored on the product'
    );
  }

  @IsTest
  static void setProductImageRejectsNonImage() {
    Product2 product = createProduct();
    Id documentId = attachFile(product.Id, 'notes.txt');
    Test.startTest();
    try {
      ProductImageController.setProductImage(product.Id, documentId);
      Assert.fail('A text file must be rejected');
    } catch (AuraHandledException ex) {
      Assert.isTrue(
        ex.getMessage().contains('Only image files'),
        ex.getMessage()
      );
    }
    Test.stopTest();
    Product2 saved = [
      SELECT Product_Image_Version_Id__c
      FROM Product2
      WHERE Id = :product.Id
      WITH SYSTEM_MODE
    ];
    Assert.isNull(saved.Product_Image_Version_Id__c, 'Field unchanged');
  }

  @IsTest
  static void uploaderPermissionSetCanSetImage() {
    User uploader = OnboardingTestFactory.createStandardUser(
      new List<String>{ 'Product_Image_Manager', 'Application_Logger' }
    );
    Product2 product = createProduct();
    Id documentId = attachFile(product.Id, 'front.png');
    String versionId;
    Test.startTest();
    System.runAs(uploader) {
      versionId = ProductImageController.setProductImage(
        product.Id,
        documentId
      );
    }
    Test.stopTest();
    Product2 saved = [
      SELECT Product_Image_Version_Id__c
      FROM Product2
      WHERE Id = :product.Id
      WITH SYSTEM_MODE
    ];
    Assert.areEqual(
      versionId,
      saved.Product_Image_Version_Id__c,
      'Product_Image_Manager can set the image'
    );
  }

  @IsTest
  static void readOnlyUserCannotSetImage() {
    User viewer = OnboardingTestFactory.createStandardUser(
      new List<String>{ 'Onboarding_Manager', 'Application_Logger' }
    );
    Product2 product = createProduct();
    Id documentId = attachFile(product.Id, 'front.png');
    Test.startTest();
    System.runAs(viewer) {
      try {
        ProductImageController.setProductImage(product.Id, documentId);
        Assert.fail(
          'A user with read-only Product access must not set the image'
        );
      } catch (AuraHandledException ex) {
        Assert.isNotNull(ex.getMessage(), 'Error message expected');
      }
    }
    Test.stopTest();
    Product2 saved = [
      SELECT Product_Image_Version_Id__c
      FROM Product2
      WHERE Id = :product.Id
      WITH SYSTEM_MODE
    ];
    Assert.isNull(saved.Product_Image_Version_Id__c, 'Field unchanged');
  }

  @IsTest
  static void nullArgumentsAreHandled() {
    Test.startTest();
    ProductImageService.ProductHero hero = ProductImageController.getProductHero(
      null
    );
    try {
      ProductImageController.setProductImage(null, null);
      Assert.fail('Null arguments must be rejected');
    } catch (AuraHandledException ex) {
      Assert.isTrue(
        ex.getMessage().contains('Choose a product'),
        ex.getMessage()
      );
    }
    Test.stopTest();
    Assert.areEqual(0, hero.images.size(), 'Empty hero for a null product');
  }

  @IsTest
  static void setProductImageRejectsFileOfAnotherProduct() {
    Product2 product = createProduct();
    Product2 other = createProduct();
    Id documentId = attachFile(other.Id, 'other.png');
    Test.startTest();
    try {
      ProductImageController.setProductImage(product.Id, documentId);
      Assert.fail('A file of another product must be rejected');
    } catch (AuraHandledException ex) {
      Assert.isTrue(ex.getMessage().contains('not attached'), ex.getMessage());
    }
    Test.stopTest();
  }
}
