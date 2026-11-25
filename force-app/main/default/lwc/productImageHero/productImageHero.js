import { LightningElement, api, wire } from "lwc";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import { refreshApex } from "@salesforce/apex";
import getProductHero from "@salesforce/apex/ProductImageController.getProductHero";
import NAME_FIELD from "@salesforce/schema/Product2.Name";
import FAMILY_FIELD from "@salesforce/schema/Product2.Family";
import DESCRIPTION_FIELD from "@salesforce/schema/Product2.Description";
import IMAGE_FIELD from "@salesforce/schema/Product2.Product_Image_Version_Id__c";

const IMAGE_URL = "/sfc/servlet.shepherd/version/download/";

function reduceError(error) {
  if (!error) return "Unknown error";
  if (Array.isArray(error.body))
    return error.body.map((e) => e.message).join(", ");
  return error.body?.message || error.message || "Unknown error";
}

/**
 * KAN-9: top section of the Product record page. Image gallery on the left; brand (Family), name, standard price
 * and description on the right. Refreshes the gallery when Product_Image_Version_Id__c changes (a new upload).
 */
export default class ProductImageHero extends LightningElement {
  @api recordId;

  product;
  hero;
  recordError;
  heroError;
  wiredHeroResult;
  lastImageId;
  index = 0;

  @wire(getRecord, {
    recordId: "$recordId",
    fields: [NAME_FIELD],
    optionalFields: [FAMILY_FIELD, DESCRIPTION_FIELD, IMAGE_FIELD]
  })
  wiredProduct({ data, error }) {
    if (data) {
      this.product = data;
      this.recordError = undefined;
      const imageId = getFieldValue(data, IMAGE_FIELD);
      // The image field changes after an upload on the Product Image tab: reload the cached gallery.
      if (this.lastImageId !== undefined && imageId !== this.lastImageId) {
        this.index = 0;
        refreshApex(this.wiredHeroResult).catch((refreshError) => {
          this.heroError = reduceError(refreshError);
        });
      }
      this.lastImageId = imageId;
    } else if (error) {
      this.recordError = reduceError(error);
    }
  }

  @wire(getProductHero, { productId: "$recordId" })
  wiredHero(result) {
    this.wiredHeroResult = result;
    if (result.data) {
      this.hero = result.data;
      this.heroError = undefined;
      if (this.index >= this.images.length) this.index = 0;
    } else if (result.error) {
      this.heroError = reduceError(result.error);
    }
  }

  get isLoading() {
    return !this.errorMessage && (!this.product || !this.hero);
  }

  get errorMessage() {
    return this.recordError || this.heroError;
  }

  get name() {
    return this.product ? getFieldValue(this.product, NAME_FIELD) : "";
  }

  get family() {
    return this.product ? getFieldValue(this.product, FAMILY_FIELD) : null;
  }

  get description() {
    return this.product ? getFieldValue(this.product, DESCRIPTION_FIELD) : null;
  }

  /** Gallery images; the saved product image (Product_Image_Version_Id__c) always comes first. */
  get images() {
    const images = this.hero?.images || [];
    const primaryId = this.lastImageId;
    const primary = images.find((image) => image.versionId === primaryId);
    return primary
      ? [primary, ...images.filter((image) => image !== primary)]
      : images;
  }

  get hasImages() {
    return this.images.length > 0;
  }

  get hasMany() {
    return this.images.length > 1;
  }

  get currentImage() {
    return this.images[this.index];
  }

  get currentImageUrl() {
    return this.currentImage ? IMAGE_URL + this.currentImage.versionId : "";
  }

  get currentAlt() {
    return `${this.name} - image ${this.index + 1} of ${this.images.length}`;
  }

  get hasPrice() {
    return this.hero?.price !== null && this.hero?.price !== undefined;
  }

  get price() {
    return this.hero?.price;
  }

  get dots() {
    return this.images.map((image, i) => ({
      key: image.versionId,
      index: i,
      label: `Show image ${i + 1} of ${this.images.length}`,
      current: i === this.index ? "true" : "false",
      className: i === this.index ? "dot dot_active" : "dot"
    }));
  }

  handlePrevious() {
    this.index = (this.index - 1 + this.images.length) % this.images.length;
  }

  handleNext() {
    this.index = (this.index + 1) % this.images.length;
  }

  handleDot(event) {
    this.index = Number(event.currentTarget.dataset.index);
  }
}
