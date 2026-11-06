import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getInternalAccounts from '@salesforce/apex/LcmNotificationController.getInternalAccounts';
import sendNotification from '@salesforce/apex/LcmNotificationController.sendNotification';

const MAX_VENDORS = 100;
const MAX_COMMENTS = 1000;
const NO_EMAIL = 'No email';

const COLUMNS = [
    { label: 'Vendor', fieldName: 'Name', wrapText: true },
    {
        label: 'Email',
        fieldName: 'emailDisplay',
        cellAttributes: { class: { fieldName: 'emailClass' }, iconName: { fieldName: 'emailIcon' } }
    },
    { label: 'Industry', fieldName: 'Industry' },
    { label: 'Location', fieldName: 'location' }
];

function reduceError(error) {
    if (!error) return 'Unknown error';
    if (Array.isArray(error.body)) return error.body.map((e) => e.message).join(', ');
    return error.body?.message || error.message || 'Unknown error';
}

export default class LcmVendorNotifier extends LightningElement {
    @api recordId;

    columns = COLUMNS;
    maxVendors = MAX_VENDORS;
    maxComments = MAX_COMMENTS;
    typeOptions = [
        { label: 'New Account', value: 'New Account' },
        { label: 'Account Update', value: 'Account Update' }
    ];

    vendors = [];
    error;
    isLoading = true;
    isSending = false;

    notificationType = 'Account Update';
    comments = '';
    searchTerm = '';
    selectedIds = new Set();

    wiredResult;

    @wire(getInternalAccounts, { accountId: '$recordId' })
    wiredVendors(result) {
        this.wiredResult = result;
        const { data, error } = result;
        if (data) {
            this.vendors = data.map((v) => ({
                ...v,
                hasEmail: Boolean(v.Email__c),
                emailDisplay: v.Email__c || NO_EMAIL,
                emailClass: v.Email__c ? '' : 'slds-text-color_error',
                emailIcon: v.Email__c ? '' : 'utility:warning',
                location: [v.BillingCity, v.BillingCountry].filter(Boolean).join(', ')
            }));
            // Drop selections that are no longer in the list.
            const ids = new Set(this.vendors.map((v) => v.Id));
            this.selectedIds = new Set([...this.selectedIds].filter((id) => ids.has(id)));
            this.error = undefined;
            this.isLoading = false;
        } else if (error) {
            this.vendors = [];
            this.error = reduceError(error);
            this.isLoading = false;
        }
    }

    // ------------------------------------------------------------------ view model

    get hasVendors() {
        return this.vendors.length > 0;
    }

    get visibleRows() {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) return this.vendors;
        return this.vendors.filter(
            (v) => v.Name.toLowerCase().includes(term) || (v.Email__c || '').toLowerCase().includes(term)
        );
    }

    get noMatches() {
        return this.hasVendors && this.visibleRows.length === 0;
    }

    get selectedIdList() {
        return [...this.selectedIds];
    }

    get selectedCount() {
        return this.selectedIds.size;
    }

    get selectedMissingEmail() {
        return this.vendors.filter((v) => this.selectedIds.has(v.Id) && !v.hasEmail).length;
    }

    get missingEmailCount() {
        return this.selectedMissingEmail;
    }

    get missingEmailText() {
        const n = this.selectedMissingEmail;
        return `${n} selected vendor${n === 1 ? ' has' : 's have'} no email address and will be skipped.`;
    }

    get selectionLabel() {
        const n = this.selectedCount;
        return n === 0 ? 'No vendors selected' : `${n} vendor${n === 1 ? '' : 's'} selected`;
    }

    get sendLabel() {
        const sendable = this.selectedCount - this.selectedMissingEmail;
        return sendable > 0 ? `Send (${sendable})` : 'Send';
    }

    get isSendDisabled() {
        return this.isSending || this.selectedCount - this.selectedMissingEmail === 0 || !this.notificationType;
    }

    // ------------------------------------------------------------------ handlers

    handleTypeChange(event) {
        this.notificationType = event.detail.value;
    }

    handleCommentsChange(event) {
        this.comments = event.detail.value;
    }

    handleSearch(event) {
        this.searchTerm = event.detail.value || '';
    }

    /** The datatable only reports rows it shows; keep selections of rows hidden by the search. */
    handleRowSelection(event) {
        const visibleIds = new Set(this.visibleRows.map((r) => r.Id));
        const next = new Set([...this.selectedIds].filter((id) => !visibleIds.has(id)));
        event.detail.selectedRows.forEach((row) => next.add(row.Id));
        this.selectedIds = next;
    }

    async handleRefresh() {
        this.isLoading = true;
        try {
            await refreshApex(this.wiredResult);
        } finally {
            this.isLoading = false;
        }
    }

    async handleSend() {
        this.isSending = true;
        try {
            const result = await sendNotification({
                accountId: this.recordId,
                vendorIds: this.selectedIdList,
                notificationType: this.notificationType,
                comments: this.comments
            });
            this.showResult(result);
            if (result.sent > 0) {
                this.selectedIds = new Set();
                this.comments = '';
            }
            // Refresh the LCM Notifications related list.
            await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
        } catch (error) {
            this.toast('Notifications not sent', reduceError(error), 'error');
        } finally {
            this.isSending = false;
        }
    }

    showResult({ sent, skipped, failed, problems }) {
        const parts = [`Sent to ${sent} vendor${sent === 1 ? '' : 's'}.`];
        if (skipped) parts.push(`${skipped} skipped.`);
        if (failed) parts.push(`${failed} failed.`);
        if (problems?.length) parts.push(problems.join(' '));
        let variant = 'success';
        if (failed && !sent) variant = 'error';
        else if (failed || skipped) variant = 'warning';
        this.toast(sent ? 'Vendors notified' : 'No notifications sent', parts.join(' '), variant);
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant, mode: variant === 'success' ? 'dismissible' : 'sticky' }));
    }
}
