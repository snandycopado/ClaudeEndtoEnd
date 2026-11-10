import { createElement } from "lwc";
import OnboardingTaskTracker from "c/onboardingTaskTracker";
import getTasks from "@salesforce/apex/OnboardingTaskController.getTasks";
import completeTask from "@salesforce/apex/OnboardingTaskController.completeTask";
import { NavigationMixin } from "lightning/navigation";
import { getRecord } from "lightning/uiRecordApi";
import { refreshApex } from "@salesforce/apex";

jest.mock(
  "@salesforce/apex",
  () => ({ refreshApex: jest.fn(() => Promise.resolve()) }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/OnboardingTaskController.getTasks",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/OnboardingTaskController.completeTask",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock("lightning/navigation", () => {
  const Navigate = Symbol("Navigate");
  const GenerateUrl = Symbol("GenerateUrl");
  const mockNavigate = jest.fn();
  const mockGenerateUrl = jest.fn();
  const MockNavigationMixin = (Base) =>
    class extends Base {
      [Navigate](pageRef) {
        mockNavigate(pageRef);
      }
      [GenerateUrl](pageRef) {
        return mockGenerateUrl(pageRef);
      }
    };
  MockNavigationMixin.Navigate = Navigate;
  MockNavigationMixin.GenerateUrl = GenerateUrl;
  MockNavigationMixin.mockNavigate = mockNavigate;
  MockNavigationMixin.mockGenerateUrl = mockGenerateUrl;
  return { NavigationMixin: MockNavigationMixin };
});

const TASKS = [
  {
    Id: "a01000000000001AAA",
    Name: "KYC Verification",
    Order__c: 10,
    Status__c: "Not Started",
    Description__c: "Check identity"
  },
  {
    Id: "a01000000000002AAA",
    Name: "Contract Signature",
    Order__c: 20,
    Status__c: "In Progress"
  },
  {
    Id: "a01000000000003AAA",
    Name: "Welcome Call",
    Order__c: 30,
    Status__c: "Completed",
    Completed_Date__c: "2026-11-10T10:00:00.000Z",
    Completed_By__r: { Name: "Ana Admin" }
  }
];

const urlFor = (id) => `/lightning/r/Onboarding_Task__c/${id}/view`;
// Lets wire emits, GenerateUrl promises and re-renders settle (test-only use of a timer).
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function createTracker() {
  const element = createElement("c-onboarding-task-tracker", {
    is: OnboardingTaskTracker
  });
  element.recordId = "001000000000001AAA";
  document.body.appendChild(element);
  return element;
}

function links(element) {
  return Array.from(element.shadowRoot.querySelectorAll("a.task-link"));
}

function click(link, init = {}) {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init
  });
  link.dispatchEvent(event);
  return event;
}

describe("c-onboarding-task-tracker", () => {
  beforeEach(() => {
    NavigationMixin.mockGenerateUrl.mockImplementation((ref) =>
      Promise.resolve(urlFor(ref.attributes.recordId))
    );
  });

  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("shows a spinner before data arrives", () => {
    const element = createTracker();
    expect(
      element.shadowRoot.querySelector("lightning-spinner")
    ).not.toBeNull();
  });

  it("shows the empty state when there are no tasks", async () => {
    const element = createTracker();
    getTasks.emit([]);
    await flush();
    expect(element.shadowRoot.textContent).toContain(
      "No onboarding tasks yet."
    );
    expect(links(element)).toHaveLength(0);
  });

  it("shows an error message when getTasks fails", async () => {
    const element = createTracker();
    getTasks.error({ message: "Boom" });
    await flush();
    expect(
      element.shadowRoot.querySelector('[role="alert"]').textContent
    ).toContain("Boom");
  });

  it("renders a link for every task, including Completed ones", async () => {
    const element = createTracker();
    getTasks.emit(TASKS);
    await flush();
    const rendered = links(element);
    expect(rendered.map((a) => a.textContent)).toEqual([
      "KYC Verification",
      "Contract Signature",
      "Welcome Call"
    ]);
    expect(rendered.map((a) => a.dataset.id)).toEqual(TASKS.map((t) => t.Id));
  });

  it("takes each href from GenerateUrl for the task record page", async () => {
    const element = createTracker();
    getTasks.emit(TASKS);
    await flush();
    expect(NavigationMixin.mockGenerateUrl).toHaveBeenCalledWith({
      type: "standard__recordPage",
      attributes: {
        recordId: TASKS[0].Id,
        objectApiName: "Onboarding_Task__c",
        actionName: "view"
      }
    });
    links(element).forEach((a, i) =>
      expect(a.getAttribute("href")).toBe(urlFor(TASKS[i].Id))
    );
  });

  it("is a keyboard-accessible link named after the task", async () => {
    const element = createTracker();
    getTasks.emit(TASKS);
    await flush();
    const link = links(element)[0];
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBeTruthy();
    expect(link.getAttribute("tabindex")).not.toBe("-1");
    expect(link.getAttribute("title")).toBe("Open KYC Verification");
  });

  it("navigates to the task record page on a plain click", async () => {
    const element = createTracker();
    getTasks.emit(TASKS);
    await flush();
    const event = click(links(element)[1]);
    expect(event.defaultPrevented).toBe(true);
    expect(NavigationMixin.mockNavigate).toHaveBeenCalledTimes(1);
    expect(NavigationMixin.mockNavigate).toHaveBeenCalledWith({
      type: "standard__recordPage",
      attributes: {
        recordId: TASKS[1].Id,
        objectApiName: "Onboarding_Task__c",
        actionName: "view"
      }
    });
  });

  it("leaves ctrl-, cmd- and middle-clicks to the browser (new tab)", async () => {
    const element = createTracker();
    getTasks.emit(TASKS);
    await flush();
    const link = links(element)[0];
    [{ ctrlKey: true }, { metaKey: true }, { button: 1 }].forEach((init) => {
      expect(click(link, init).defaultPrevented).toBe(false);
    });
    expect(NavigationMixin.mockNavigate).not.toHaveBeenCalled();
  });

  it("still navigates (also on ctrl-click) when GenerateUrl fails, and warns only once", async () => {
    NavigationMixin.mockGenerateUrl.mockImplementation(() =>
      Promise.reject(new Error("No URL"))
    );
    const element = createTracker();
    const toasts = [];
    element.addEventListener("lightning__showtoast", (e) =>
      toasts.push(e.detail)
    );
    getTasks.emit(TASKS);
    await flush();
    getTasks.emit([...TASKS]);
    await flush();
    expect(toasts.map((t) => t.variant)).toEqual(["warning"]);
    const link = links(element)[0];
    expect(link.getAttribute("href")).toBe("#");
    expect(click(link, { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(NavigationMixin.mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest URLs when GenerateUrl calls finish out of order", async () => {
    const pending = [];
    NavigationMixin.mockGenerateUrl.mockImplementation(
      (ref) =>
        new Promise((resolve) =>
          pending.push(() =>
            resolve(`${urlFor(ref.attributes.recordId)}?n=${pending.length}`)
          )
        )
    );
    const element = createTracker();
    getTasks.emit([TASKS[0]]);
    await flush();
    getTasks.emit([TASKS[0]]);
    await flush();
    pending[1](); // newer request resolves first
    await flush();
    pending[0](); // stale request resolves last and must be ignored
    await flush();
    expect(links(element)[0].getAttribute("href")).toBe(
      `${urlFor(TASKS[0].Id)}?n=2`
    );
  });

  it("reloads the task list when the Account task roll-ups change (edited on the task page)", async () => {
    const element = createTracker();
    getTasks.emit(TASKS);
    const account = (completed) => ({
      fields: {
        Account_Status__c: { value: "Start Onboarding" },
        Onboarding_Tasks_Completed__c: { value: completed },
        Onboarding_Tasks_Total__c: { value: 3 }
      }
    });
    getRecord.emit(account(1));
    await flush();
    expect(refreshApex).not.toHaveBeenCalled();
    getRecord.emit(account(0));
    await flush();
    expect(refreshApex).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelectorAll("a.task-link")).toHaveLength(3);
  });

  it("completing a task with the checkbox does not navigate", async () => {
    completeTask.mockResolvedValue(undefined);
    const element = createTracker();
    getTasks.emit(TASKS);
    await flush();
    const checkbox = element.shadowRoot.querySelector(
      `lightning-input[data-id="${TASKS[0].Id}"]`
    );
    checkbox.checked = true;
    checkbox.dispatchEvent(new CustomEvent("change"));
    await flush();
    expect(completeTask).toHaveBeenCalledWith({ taskId: TASKS[0].Id });
    expect(NavigationMixin.mockNavigate).not.toHaveBeenCalled();
  });

  it("shows an error toast and resets the checkbox when completing fails", async () => {
    completeTask.mockRejectedValue({ body: { message: "Locked" } });
    const element = createTracker();
    const toasts = [];
    element.addEventListener("lightning__showtoast", (e) =>
      toasts.push(e.detail)
    );
    getTasks.emit(TASKS);
    await flush();
    const checkbox = element.shadowRoot.querySelector(
      `lightning-input[data-id="${TASKS[0].Id}"]`
    );
    checkbox.checked = true;
    checkbox.dispatchEvent(new CustomEvent("change"));
    await flush();
    expect(toasts).toEqual([
      expect.objectContaining({ variant: "error", message: "Locked" })
    ]);
    expect(checkbox.checked).toBe(false);
    expect(NavigationMixin.mockNavigate).not.toHaveBeenCalled();
  });
});
