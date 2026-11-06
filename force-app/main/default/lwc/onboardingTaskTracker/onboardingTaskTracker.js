import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { getRecord, getFieldValue, notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getTasks from '@salesforce/apex/OnboardingTaskController.getTasks';
import completeTask from '@salesforce/apex/OnboardingTaskController.completeTask';
import ACCOUNT_STATUS_FIELD from '@salesforce/schema/Account.Account_Status__c';

const COMPLETED = 'Completed';
const BADGE = {
    Completed: 'slds-badge slds-theme_success',
    'In Progress': 'slds-badge slds-theme_warning',
    'Not Started': 'slds-badge'
};

function reduceError(error) {
    if (!error) return 'Unknown error';
    if (Array.isArray(error.body)) return error.body.map((e) => e.message).join(', ');
    return error.body?.message || error.message || 'Unknown error';
}

export default class OnboardingTaskTracker extends LightningElement {
    @api recordId;

    tasks = [];
    error;
    isLoading = true;
    savingIds = new Set();

    wiredTasksResult;
    lastAccountStatus;

    @wire(getRecord, { recordId: '$recordId', fields: [ACCOUNT_STATUS_FIELD] })
    wiredAccount({ data }) {
        if (!data) return;
        const status = getFieldValue(data, ACCOUNT_STATUS_FIELD);
        // Status changed on the page (e.g. via Path) -> tasks may have been generated or the account activated.
        if (this.lastAccountStatus !== undefined && status !== this.lastAccountStatus && this.wiredTasksResult) {
            refreshApex(this.wiredTasksResult);
        }
        this.lastAccountStatus = status;
    }

    @wire(getTasks, { accountId: '$recordId' })
    wiredTasks(result) {
        this.wiredTasksResult = result;
        const { data, error } = result;
        if (data) {
            this.tasks = data;
            this.error = undefined;
            this.isLoading = false;
        } else if (error) {
            this.tasks = [];
            this.error = reduceError(error);
            this.isLoading = false;
        }
    }

    // ------------------------------------------------------------------ view model

    get hasTasks() {
        return this.tasks.length > 0;
    }

    get totalCount() {
        return this.tasks.length;
    }

    get completedCount() {
        return this.tasks.filter((t) => t.Status__c === COMPLETED).length;
    }

    get percentComplete() {
        return this.totalCount === 0 ? 0 : Math.round((this.completedCount / this.totalCount) * 100);
    }

    get percentLabel() {
        return `${this.percentComplete}%`;
    }

    get progressLabel() {
        return `${this.completedCount} of ${this.totalCount} tasks completed`;
    }

    get overallStatus() {
        if (!this.hasTasks) return 'Not Started';
        return this.completedCount === this.totalCount ? 'Completed' : 'In Progress';
    }

    get overallBadgeClass() {
        return BADGE[this.overallStatus];
    }

    get accountStatus() {
        return this.lastAccountStatus || '—';
    }

    get rows() {
        return this.tasks.map((t) => {
            const isCompleted = t.Status__c === COMPLETED;
            return {
                id: t.Id,
                name: t.Name,
                order: t.Order__c,
                description: t.Description__c,
                status: t.Status__c,
                isCompleted,
                isDisabled: isCompleted || this.savingIds.has(t.Id),
                completedDate: t.Completed_Date__c,
                completedBy: t.Completed_By__r?.Name,
                checkboxLabel: `Mark ${t.Name} as completed`,
                badgeClass: BADGE[t.Status__c] || 'slds-badge',
                nameClass: isCompleted ? 'slds-text-heading_small task-done' : 'slds-text-heading_small'
            };
        });
    }

    // ------------------------------------------------------------------ actions

    async handleComplete(event) {
        const checkbox = event.target;
        const taskId = checkbox.dataset.id;
        if (!checkbox.checked) return; // completed tasks are locked; nothing to undo

        this.savingIds = new Set([...this.savingIds, taskId]);
        try {
            await completeTask({ taskId });
            await refreshApex(this.wiredTasksResult);
            // Refresh Path, highlights and detail panel (status may now be Active).
            await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Task completed',
                    message: this.completedCount === this.totalCount ? 'All onboarding tasks are complete. The account is now Active.' : this.progressLabel,
                    variant: 'success'
                })
            );
        } catch (error) {
            checkbox.checked = false;
            this.dispatchEvent(
                new ShowToastEvent({ title: 'Could not complete task', message: reduceError(error), variant: 'error' })
            );
        } finally {
            const next = new Set(this.savingIds);
            next.delete(taskId);
            this.savingIds = next;
        }
    }
}
