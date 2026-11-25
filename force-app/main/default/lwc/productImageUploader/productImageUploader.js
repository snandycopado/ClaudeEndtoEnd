import { LightningElement, api, wire } from "lwc";
import {
  getRecord,
  getFieldValue,
  notifyRecordUpdateAvailable
} from "lightning/uiRecordApi";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import PRODUCT_OBJECT from "@salesforce/schema/Product2";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import setProductImage from "@salesforce/apex/ProductImageController.setProductImage";
import NAME_FIELD from "@salesforce/schema/Product2.Name";
import IMAGE_FIELD from "@salesforce/schema/Product2.Product_Image_Version_Id__c";

const IMAGE_URL = "/sfc/servlet.shepherd/version/download/";
const ACCEPTED_FORMATS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

function reduceError(error) {
  if (!error) return "Unknown error";
  if (Array.isArray(error.body))
    return error.body.map((e) => e.message).join(", ");
  return error.body?.message || error.message || "Unknown error";
}

/**
 * KAN-9: Product Image tab. Uploads image files to the Product (lightning-file-upload) and makes the newest one the
 * product image (ProductImageController.setProductImage), then tells LDS the record changed so the hero refreshes.
 */
export default class ProductImageUploader extends LightningElement {
  @api recordId;

  acceptedFormats = ACCEPTED_FORMATS;
  product;
  recordError;
  isSaving = false;
  canUpload = false;

  // Upload needs Product edit + edit on the image field (Product_Image_Manager); read-only users only see the image.
  @wire(getObjectInfo, { objectApiName: PRODUCT_OBJECT })
  wiredObjectInfo({ data }) {
    if (data) {
      this.canUpload =
        data.updateable === true &&
        data.fields?.Product_Image_Version_Id__c?.updateable === true;
    }
  }

  @wire(getRecord, {
    recordId: "$recordId",
    fields: [NAME_FIELD],
    optionalFields: [IMAGE_FIELD]
  })
  wiredProduct({ data, error }) {
    if (data) {
      this.product = data;
      this.recordError = undefined;
    } else if (error) {
      this.recordError = reduceError(error);
    }
  }

  get isLoading() {
    return !this.product && !this.recordError;
  }

  get currentImageUrl() {
    const versionId = this.product
      ? getFieldValue(this.product, IMAGE_FIELD)
      : null;
    return versionId ? IMAGE_URL + versionId : null;
  }

  get currentAlt() {
    return `Current image of ${getFieldValue(this.product, NAME_FIELD)}`;
  }

  async handleUploadFinished(event) {
    const files = event.detail.files || [];
    if (!files.length) return;
    // Several files may be uploaded at once: all stay on the product (gallery); the last one becomes the main image.
    const last = files[files.length - 1];
    this.isSaving = true;
    try {
      await setProductImage({
        productId: this.recordId,
        contentDocumentId: last.documentId
      });
      this.toast(
        "Product image updated",
        files.length > 1
          ? `${files.length} files uploaded. "${last.name}" is now the product image.`
          : `"${last.name}" is now the product image.`,
        "success"
      );
      await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
    } catch (error) {
      this.toast("Image not set", reduceError(error), "error");
    } finally {
      this.isSaving = false;
    }
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
