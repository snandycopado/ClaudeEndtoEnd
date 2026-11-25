import { LightningElement, api, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { refreshApex } from "@salesforce/apex";
import {
  getRecord,
  getFieldValue,
  notifyRecordUpdateAvailable
} from "lightning/uiRecordApi";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import LightningConfirm from "lightning/confirm";
import getTasks from "@salesforce/apex/OnboardingTaskController.getTasks";
import completeTask from "@salesforce/apex/OnboardingTaskController.completeTask";
import reopenTask from "@salesforce/apex/OnboardingTaskController.reopenTask";
import ACCOUNT_STATUS_FIELD from "@salesforce/schema/Account.Account_Status__c";
import TASKS_COMPLETED_FIELD from "@salesforce/schema/Account.Onboarding_Tasks_Completed__c";
import TASKS_TOTAL_FIELD from "@salesforce/schema/Account.Onboarding_Tasks_Total__c";

const COMPLETED = "Completed";
const TASK_OBJECT = "Onboarding_Task__c";
const BADGE = {
  Completed: "slds-badge slds-theme_success",
  "In Progress": "slds-badge slds-theme_warning",
  "Not Started": "slds-badge"
};

function reduceError(error) {
  if (!error) return "Unknown error";
  if (Array.isArray(error.body))
    return error.body.map((e) => e.message).join(", ");
  return error.body?.message || error.message || "Unknown error";
}

function taskPageRef(taskId) {
  return {
    type: "standard__recordPage",
    attributes: {
      recordId: taskId,
      objectApiName: TASK_OBJECT,
      actionName: "view"
    }
  };
}

export default class OnboardingTaskTracker extends NavigationMixin(
  LightningElement
) {
  @api recordId;

  tasks = [];
  error;
  isLoading = true;
  savingIds = new Set();
  taskUrls = {};
  urlRequestSeq = 0;
  urlWarningShown = false;

  wiredTasksResult;
  lastAccountStatus;
  lastAccountSignature;

  @wire(getRecord, {
    recordId: "$recordId",
    fields: [ACCOUNT_STATUS_FIELD],
    optionalFields: [TASKS_COMPLETED_FIELD, TASKS_TOTAL_FIELD]
  })
  wiredAccount({ data }) {
    if (!data) return;
    const status = getFieldValue(data, ACCOUNT_STATUS_FIELD);
    // Status (e.g. via Path) or the task roll-ups changed -> tasks were generated, completed or edited
    // elsewhere, for example on a task's own record page (KAN-3). Reload the cached task list.
    const signature = [
      status,
      getFieldValue(data, TASKS_COMPLETED_FIELD),
      getFieldValue(data, TASKS_TOTAL_FIELD)
    ].join("|");
    if (
      this.lastAccountSignature !== undefined &&
      signature !== this.lastAccountSignature
    ) {
      this.refreshTasks();
    }
    this.lastAccountSignature = signature;
    this.lastAccountStatus = status;
  }

  refreshTasks() {
    if (!this.wiredTasksResult) return;
    refreshApex(this.wiredTasksResult).catch((error) => {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Could not refresh onboarding tasks",
          message: reduceError(error),
          variant: "error"
        })
      );
    });
  }

  @wire(getTasks, { accountId: "$recordId" })
  wiredTasks(result) {
    this.wiredTasksResult = result;
    const { data, error } = result;
    if (data) {
      this.tasks = data;
      this.error = undefined;
      this.isLoading = false;
      this.generateTaskUrls(data);
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
    return this.totalCount === 0
      ? 0
      : Math.round((this.completedCount / this.totalCount) * 100);
  }

  get percentLabel() {
    return `${this.percentComplete}%`;
  }

  get progressLabel() {
    return `${this.completedCount} of ${this.totalCount} tasks completed`;
  }

  get overallStatus() {
    if (!this.hasTasks) return "Not Started";
    return this.completedCount === this.totalCount
      ? "Completed"
      : "In Progress";
  }

  get overallBadgeClass() {
    return BADGE[this.overallStatus];
  }

  get accountStatus() {
    return this.lastAccountStatus || "—";
  }

  get rows() {
    return this.tasks.map((t) => {
      const isCompleted = t.Status__c === COMPLETED;
      return {
        id: t.Id,
        name: t.Name,
        // '#' until GenerateUrl resolves (or if it fails) keeps the <a> focusable; handleOpenTask navigates.
        url: this.taskUrls[t.Id] || "#",
        linkTitle: `Open ${t.Name}`,
        order: t.Order__c,
        description: t.Description__c,
        status: t.Status__c,
        isCompleted,
        // KAN-6: completed tasks can be unticked (reopened); only an in-flight save disables the box.
        isDisabled: this.savingIds.has(t.Id),
        completedDate: t.Completed_Date__c,
        completedBy: t.Completed_By__r?.Name,
        checkboxLabel: isCompleted
          ? `Mark ${t.Name} as in progress`
          : `Mark ${t.Name} as completed`,
        badgeClass: BADGE[t.Status__c] || "slds-badge",
        // KAN-4: completed tasks are not struck through; the badge, checkbox and "Completed by" line show the status.
        nameClass: "slds-text-heading_small"
      };
    });
  }

  // ------------------------------------------------------------------ navigation (KAN-3)

  async generateTaskUrls(tasks) {
    const seq = ++this.urlRequestSeq;
    try {
      const urls = await Promise.all(
        tasks.map((t) => this[NavigationMixin.GenerateUrl](taskPageRef(t.Id)))
      );
      if (seq !== this.urlRequestSeq) return; // a newer task list is being resolved
      const next = {};
      tasks.forEach((t, i) => {
        next[t.Id] = urls[i];
      });
      this.taskUrls = next;
    } catch (error) {
      // Links still work through handleOpenTask -> Navigate; only open-in-new-tab is lost. Warn once.
      if (!this.urlWarningShown) {
        this.urlWarningShown = true;
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Task links unavailable",
            message: reduceError(error),
            variant: "warning"
          })
        );
      }
    }
  }

  handleOpenTask(event) {
    const hasRealUrl = Boolean(this.taskUrls[event.currentTarget.dataset.id]);
    // Ctrl/Cmd/Shift-click or middle-click on a real URL: let the browser open it in a new tab or window.
    if (
      hasRealUrl &&
      (event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.button !== undefined && event.button !== 0))
    ) {
      return;
    }
    event.preventDefault();
    this[NavigationMixin.Navigate](taskPageRef(event.currentTarget.dataset.id));
  }

  // ------------------------------------------------------------------ actions

  isTaskCompleted(taskId) {
    return this.tasks.find((t) => t.Id === taskId)?.Status__c === COMPLETED;
  }

  releaseTask(taskId) {
    const next = new Set(this.savingIds);
    next.delete(taskId);
    this.savingIds = next;
  }

  /** KAN-7: standard Salesforce confirmation dialog. Resolves true only when the user clicks OK. */
  async confirmComplete(taskId) {
    const task = this.tasks.find((t) => t.Id === taskId);
    const name = task ? task.Name : "this task";
    const isLastOpen = this.totalCount - this.completedCount === 1;
    const result = await LightningConfirm.open({
      label: "Complete task",
      message:
        `Complete "${name}"?` +
        (isLastOpen
          ? " This is the last open task. The account will become Active."
          : ""),
      theme: "default"
    });
    return result === true;
  }

  async handleComplete(event) {
    const checkbox = event.target;
    const taskId = checkbox.dataset.id;
    // Ticked -> complete the task; unticked -> reopen it as In Progress (KAN-6).
    const completing = checkbox.checked;
    // Re-entrancy guard: a second change (fast double-click) while the dialog opens or a save runs is ignored.
    if (this.savingIds.has(taskId)) {
      return;
    }
    // Disable the box from now on: covers the confirmation dialog and the save.
    this.savingIds = new Set([...this.savingIds, taskId]);

    // KAN-7: completing asks for confirmation first; Cancel/Esc saves nothing. Reopening needs no confirmation.
    let confirmed = true;
    if (completing) {
      try {
        confirmed = await this.confirmComplete(taskId);
      } catch (error) {
        confirmed = false;
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Could not open the confirmation",
            message: reduceError(error),
            variant: "error"
          })
        );
      }
    }
    if (!confirmed) {
      // Show the task's current state (it may have been completed elsewhere while the dialog was open).
      checkbox.checked = this.isTaskCompleted(taskId);
      this.releaseTask(taskId);
      return;
    }

    try {
      if (completing) {
        await completeTask({ taskId });
      } else {
        await reopenTask({ taskId });
      }
      await refreshApex(this.wiredTasksResult);
      // Refresh Path, highlights and detail panel (status may now be Active, or back to Start Onboarding).
      await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
      this.dispatchEvent(
        new ShowToastEvent(
          completing
            ? {
                title: "Task completed",
                message:
                  this.completedCount === this.totalCount
                    ? "All onboarding tasks are complete. The account is now Active."
                    : this.progressLabel,
                variant: "success"
              }
            : {
                title: "Task reopened",
                message: `The task is In Progress again. ${this.progressLabel}.`,
                variant: "success"
              }
        )
      );
    } catch (error) {
      checkbox.checked = !completing;
      this.dispatchEvent(
        new ShowToastEvent({
          title: completing
            ? "Could not complete task"
            : "Could not reopen task",
          message: reduceError(error),
          variant: "error"
        })
      );
    } finally {
      const next = new Set(this.savingIds);
      next.delete(taskId);
      this.savingIds = next;
    }
  }
}
