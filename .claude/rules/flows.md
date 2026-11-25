---
paths:
  - "**/flows/**"
---
# Flow rules

- Apex triggers own record automation on objects that already have a TriggerHandler (Account,
  Onboarding_Task__c). Do not add a record-triggered flow that duplicates handler logic — ask first.
- At most one record-triggered flow per object per context (before-save / after-save); entry criteria always set.
- Every DML, callout or Apex action element has a fault path that calls an invocable logging action
  (to be added to the exception framework) — until then, ask before building a flow with fault paths.
- No hard-coded Ids; use Custom Metadata, Custom Labels or `$Record` relationships.
- Screen flows run in user context; autolaunched flows state their run mode in the description.
- Name: `<Module>_<Object>_<Purpose>` (e.g. `Onboarding_Account_Welcome`); every element has a description.
