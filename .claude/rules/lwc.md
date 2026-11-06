---
paths:
  - "**/lwc/**"
---
# LWC rules

- Lightning Data Service first (`getRecord`, `lightning-record-form`, `updateRecord`); Apex only when LDS
  cannot do it (multi-object queries, business logic, bulk writes).
- Apex reads: `@AuraEnabled(cacheable=true)` + `@wire`. Writes: imperative call, then `refreshApex(wiredResult)`
  and `notifyRecordUpdateAvailable([{ recordId }])` so Path, highlights and related lists refresh.
- Store the whole wire result (`this.wiredResult = result`) so `refreshApex` works.
- Errors: show a toast using the `reduceError(error)` helper pattern (see onboardingTaskTracker.js); never
  `console.log`, never swallow.
- Loading, empty and error states are always rendered (`lwc:if / lwc:elseif / lwc:else`).
- SLDS classes and base components only; no custom colours outside SLDS styling hooks.
- Accessible: every input has a label (use `variant="label-hidden"` to hide it visually), icons have
  `alternative-text`.
- Reactivity: replace Sets/arrays (`this.ids = new Set([...this.ids, id])`), don't mutate in place.
- Expose on `lightning__RecordPage` with a `targetConfig` listing the objects; set `masterLabel` and `description`.
- New components get a Jest test in `__tests__/` (`npm run test:unit`).
