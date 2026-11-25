# E2E scenarios — <KEY>

Add to the plan's Low Level Design. One row per acceptance criterion.

| ID    | Scenario (user steps)                           | UI check                                         | Data check (SOQL)           | AC   |
| ----- | ----------------------------------------------- | ------------------------------------------------ | --------------------------- | ---- |
| TC-nn | Open **<Tab>** → New → record type **<RT>** → … | What the user sees (badge, toast, dialog, field) | Field values after the step | AC n |

Spec file: `.claude/e2e/specs/<module>/<feature>.e2e.js` · Page object: `.claude/e2e/pages/<module>-<component>.js`
Test data: created in the UI, names from `uniqueName('<tag>')` (prefix `E2E-`), not deleted.
