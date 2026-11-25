// Page object for the onboardingTaskTracker LWC on the Account record page (Onboarding module).
const { expect } = require("@playwright/test");

class OnboardingTracker {
  constructor(page) {
    this.page = page;
    this.root = page.locator("c-onboarding-task-tracker:visible").first();
  }

  rows() {
    return this.root.locator("li.task-row");
  }

  taskLinks() {
    return this.root.locator("a.task-link");
  }

  row(taskName) {
    return this.rows().filter({
      has: this.page.locator("a.task-link", { hasText: taskName })
    });
  }

  checkbox(taskName) {
    return this.row(taskName).locator('input[type="checkbox"]');
  }

  rowBadge(taskName) {
    return this.row(taskName).locator(".slds-badge").last();
  }

  overallBadge() {
    return this.root.locator('[slot="actions"] .slds-badge');
  }

  progress() {
    return this.root.getByText(/\d+ of \d+ tasks completed/);
  }

  accountStatus() {
    return this.root.getByText(/Account status:/);
  }

  emptyState() {
    return this.root.getByText("No onboarding tasks yet");
  }

  /** Tick or untick a task the way a user does (click the visible checkbox). */
  async toggle(taskName) {
    await this.row(taskName).locator(".slds-checkbox_faux").click();
  }

  /** The KAN-7 LightningConfirm dialog. */
  confirmDialog() {
    return this.page
      .locator('[role="alertdialog"], [role="dialog"]')
      .filter({ hasText: "Complete task" })
      .last();
  }

  async confirm(choice) {
    const dialog = this.confirmDialog();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: choice, exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  /** Computed text-decoration of the task name (KAN-4: never struck through). */
  async nameDecoration(taskName) {
    return this.row(taskName)
      .locator("a.task-link")
      .evaluate((el) => {
        const decorations = [];
        for (
          let n = el;
          n && n.nodeType === 1;
          n = n.parentElement || n.getRootNode()?.host
        ) {
          decorations.push(getComputedStyle(n).textDecorationLine);
          if (n.tagName === "LI") break;
        }
        return decorations.join(" ");
      });
  }
}

module.exports = { OnboardingTracker };
