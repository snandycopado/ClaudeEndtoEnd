import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getItems from '@salesforce/apex/FeatureController.getItems';

function reduceError(error) {
    if (!error) return 'Unknown error';
    if (Array.isArray(error.body)) return error.body.map((e) => e.message).join(', ');
    return error.body?.message || error.message || 'Unknown error';
}

export default class ComponentName extends LightningElement {
    @api recordId;
    items = [];
    error;
    isLoading = true;
    wiredResult;

    @wire(getItems, { recordId: '$recordId' })
    wiredItems(result) {
        this.wiredResult = result;
        if (result.data) {
            this.items = result.data;
            this.error = undefined;
            this.isLoading = false;
        } else if (result.error) {
            this.items = [];
            this.error = reduceError(result.error);
            this.isLoading = false;
        }
    }

    get hasItems() {
        return this.items.length > 0;
    }

    async refresh() {
        await refreshApex(this.wiredResult);
        await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
