---
name: lwc-component
description: Scaffold a Lightning Web Component in this repo's pattern - LDS/wire first, Apex only if needed, loading/empty/error states, toasts, Jest test. Use when creating a new LWC.
---
# New LWC

1. Read `.claude/rules/lwc.md`.
2. Folder: `force-app/main/default/lwc/<modulePrefix><Name>/` (e.g. `offboardingChecklist`) — the module
   prefix makes the module's rules load. Copy `templates/` and rename `componentName`.
3. Data: try LDS first (`getRecord`, `lightning-record-form`). If Apex is needed, add a
   `<Module><Feature>Controller` (`with sharing`, `WITH USER_MODE`) and add it to the module permission set's
   `classAccesses`.
4. Keep the wire result for `refreshApex`; after writes call `notifyRecordUpdateAvailable`.
5. Add it to a page: `force-app/main/default/flexipages/Account_Record_Page.flexipage-meta.xml` is shared
   (the hook asks first). Facet names must be unique (`Facet-esm-<module>-<name>`) and facets have no `<mode>`.
6. Jest: `templates/__tests__/componentName.test.js` → `lwc/<name>/__tests__/`; run `npm run test:unit` (after `npm install`).
